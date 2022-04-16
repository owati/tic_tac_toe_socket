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
    const games_json = yield redis_client.get('game');
    const user_json = yield redis_client.get('users');
    const games = JSON.parse(String(games_json));
    const users = JSON.parse(String(user_json));
    if (!ws.id) { // the client is recognised by the server
        ws.id = yield generateId();
    }
    ws.send(JSON.stringify({
        games: games
    }));
    for (let client of lobbySocket.clients) { // send the new number of users to all clients
        client.send(JSON.stringify({
            users: users.length
        }));
    }
    ws.on('message', (message) => __awaiter(void 0, void 0, void 0, function* () {
        const data = JSON.parse(message.toString());
        console.log(data, games, users);
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
            num = Math.random() * 10000;
        } while (users.includes(num)); // ensures the number is not in the user array
        users.push(num); // adds the number to the array
        yield redis_client.set('users', JSON.stringify(users)); // sets the number back in the redis object
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
