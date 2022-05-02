'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const redis_1 = require("redis");
class Game {
    constructor(game) {
        this.game = game;
    }
    getPlayers() {
        var _a, _b;
        return [(_a = this.game) === null || _a === void 0 ? void 0 : _a.player1, (_b = this.game) === null || _b === void 0 ? void 0 : _b.player2];
    }
    setPlayer(id) {
        var _a, _b;
        if ((_a = this.game) === null || _a === void 0 ? void 0 : _a.player1) {
            if ((_b = this.game) === null || _b === void 0 ? void 0 : _b.player2) {
                return false;
            }
            else {
                this.game.player2 = id;
            }
        }
        else {
            this.game.player1 = id;
        }
        return true;
    }
    refresh() {
        return __awaiter(this, void 0, void 0, function* () {
            const games = JSON.parse(String(yield redis_client.get('game')));
            for (let game of games) {
                if (game.id === this.game.id) {
                    games[games.indexOf(game)] = this.game;
                    break;
                }
            }
            console.log(games, 3);
            yield redis_client.set('game', JSON.stringify(games));
        });
    }
    getGame() {
        return this.game;
    }
}
dotenv_1.default.config();
const app = (0, express_1.default)();
const redis_client = (0, redis_1.createClient)();
const lobbySocket = new ws_1.WebSocketServer({ noServer: true }); // server for the game lobby
const gameSocket = new ws_1.WebSocketServer({ noServer: true }); // server for the game action
lobbySocket.on('connection', (ws, req) => __awaiter(void 0, void 0, void 0, function* () {
    ws.on('message', (message) => __awaiter(void 0, void 0, void 0, function* () {
        console.log(message.toString());
        const data = JSON.parse(message.toString());
        const games = JSON.parse(String(yield redis_client.get('game')));
        if (data.type === 'game create') {
            console.log('creating a new game.................');
            let game_object = {
                name: data.name,
                id: yield generateGameId(),
                player1: null,
                player2: null,
                games_status: ['', '', '', '', '', '', '', '', '']
            };
            games.push(game_object);
            yield redis_client.set('game', JSON.stringify(games));
            ws.send(JSON.stringify({
                type: "new game",
                id: game_object.id
            }));
        }
    }));
    ws.on('close', () => __awaiter(void 0, void 0, void 0, function* () {
        console.log('closing socket for a client in the lobby');
    }));
}));
gameSocket.on('connection', (ws, req) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log(req.url);
    const game_id = (_a = req.url) === null || _a === void 0 ? void 0 : _a.split('/')[2];
    const games = JSON.parse(String(yield redis_client.get('game')));
    const game = new Game((() => {
        for (const game of games) {
            if (game.id == game_id) {
                return game;
            }
        }
        return null;
    })());
    console.log(game);
    if (game) {
        if (game.getPlayers().includes(null)) {
            if (!ws.id) {
                ws.id = yield generateId(); // give id to the player
            }
            if (game.setPlayer(ws.id)) {
                yield game.refresh();
                ws.send(JSON.stringify({
                    type: "game entrance",
                    game: game.getGame()
                }));
            }
        }
        else {
            ws.send(JSON.stringify({
                type: "full game"
            }));
            ws.close();
        }
    }
    ws.on('message', (message) => __awaiter(void 0, void 0, void 0, function* () {
        const data = JSON.parse(message.toString());
        console.log(data);
    }));
}));
function generateId() {
    return __awaiter(this, void 0, void 0, function* () {
        const users_json = yield redis_client.get('users');
        const users = JSON.parse(String(users_json));
        let num;
        do {
            num = Math.floor(Math.random() * 10000);
        } while (users.includes(num)); // ensures the number is not in the user array
        users.push(num); // adds the number to the array
        yield redis_client.set('users', JSON.stringify(users)); // sets the number back in the redis object
        return num;
    });
}
function generateGameId() {
    return __awaiter(this, void 0, void 0, function* () {
        const games = JSON.parse(String(yield redis_client.get('game')));
        let num;
        do {
            num = Math.floor(Math.random() * 10000);
        } while ((() => {
            let check = false;
            for (let { id } of games) {
                if (id == num) {
                    check = true;
                    break;
                }
            }
            return check;
        })());
        return num;
    });
}
const server = app.listen(process.env.PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('node server has started');
    yield redis_client.connect();
    const game = yield redis_client.get('game'); // get the game data from redis
    const users = yield redis_client.get('users'); // get the user data from redis
    if (!(game && users)) { // if the both of them do not exits 
        yield redis_client.set('game', '[]');
        yield redis_client.set('users', '[]');
    }
    console.log('redis server connected');
}));
server.on('upgrade', (request, socket, head) => {
    const pathname = request.url;
    if (pathname === '/lobby') {
        lobbySocket.handleUpgrade(request, socket, head, ws => {
            lobbySocket.emit('connection', ws, request);
        });
    }
    else if (pathname.includes('/game')) {
        gameSocket.handleUpgrade(request, socket, head, ws => {
            gameSocket.emit('connection', ws, request);
        });
    }
    else {
        socket.destroy();
    }
});
