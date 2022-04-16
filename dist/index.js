"use strict";
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
const express_ws_1 = __importDefault(require("express-ws"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const redis_1 = require("redis");
dotenv_1.default.config();
const wsInstance = (0, express_ws_1.default)((0, express_1.default)());
const app = wsInstance.app;
const router = express_1.default.Router();
const wss = wsInstance.getWss();
const client = (0, redis_1.createClient)();
client.connect(); // connect to redis server
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.use(body_parser_1.default.json());
app.use((0, cors_1.default)({
    origin: ''
}));
function generateClientId() {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield client.get('user');
        if (typeof user === 'string') {
            let userArray = JSON.parse(user);
            return userArray.length;
        }
    });
}
app.use((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    client.on('error', err => {
        console.log(err.message);
    });
    let games = yield client.get('games');
    let users = yield client.get('user');
    if (!(games && users)) { // creates the game and user redis objects if they do not yet exist
        yield client.set('user', '[]'); // sets the user space 
        yield client.set('games', "[]"); // sets the game space
    }
    next();
}));
app.get('/', (req, res) => {
    console.log(req.headers);
    res.send('hello world');
});
wss.on('connection', function connection(ws, req) {
    // console.log(wsInstance.getWss().clients)
    ws.send('welcome');
});
wss.on('message', function connection(ws, req) {
    console.log(ws);
});
router.ws('/home', (ws, req) => {
    ws.onmessage = (e) => {
        console.log(e);
    };
});
app.listen('3001', () => {
    console.log('node server has started...');
});
