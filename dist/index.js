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
dotenv_1.default.config();
const app = (0, express_1.default)();
const redis_client = (0, redis_1.createClient)();
const lobbySocket = new ws_1.WebSocketServer({ noServer: true }); // server for the game lobby
const gameSocket = new ws_1.WebSocketServer({ noServer: true }); // server for the game action
lobbySocket.on('connection', (ws, req) => __awaiter(void 0, void 0, void 0, function* () {
    let games = JSON.parse(String(yield redis_client.get('game')));
    let users = JSON.parse(String(yield redis_client.get('users')));
    if (!ws.id) { // the client is recognised by the server
        ws.id = yield generateId();
    }
    ws.send(JSON.stringify({
        type: "available games",
        games: games,
        games_num: games.length,
    }));
    for (let client of lobbySocket.clients) { // send the new number of users to all clients
        users = JSON.parse(String(yield redis_client.get('users'))); // refetch the user data
        client.send(JSON.stringify({
            type: "user number",
            users: users.length,
        }));
    }
    ws.on('message', (message) => __awaiter(void 0, void 0, void 0, function* () {
        const data = JSON.parse(message.toString());
        games = JSON.parse(String(yield redis_client.get('game')));
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
            for (let client of lobbySocket.clients) {
                client.send(JSON.stringify({
                    type: "available games",
                    games: games,
                    games_num: games.length
                }));
            }
        }
    }));
    ws.on('close', () => __awaiter(void 0, void 0, void 0, function* () {
        console.log('closing socket for client ' + ws.id);
        users.splice(users.indexOf(ws.id), 1);
        yield redis_client.set('users', JSON.stringify(users));
    }));
}));
gameSocket.on('connection', (ws, req) => __awaiter(void 0, void 0, void 0, function* () {
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
    else if (pathname === '/game') {
        gameSocket.handleUpgrade(request, socket, head, ws => {
            gameSocket.emit('connection', ws, request);
        });
    }
    else {
        socket.destroy();
    }
});
