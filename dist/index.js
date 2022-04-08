"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_ws_1 = __importDefault(require("express-ws"));
const wsInstance = (0, express_ws_1.default)((0, express_1.default)());
const app = wsInstance.app;
const router = express_1.default.Router();
app.get('/', (req, res) => {
    console.log(req.headers);
    res.send('hello world');
});
wsInstance.getWss().on('connection', function connection(ws) {
    console.log(wsInstance.getWss().clients);
    ws.send('welcome');
});
router.ws('/home', (ws, req) => {
    ws.on('message', () => {
        console.log(wsInstance.getWss().clients);
    });
});
app.listen('3001', () => {
    console.log('node server has started...');
});
