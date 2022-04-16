import dotenv from 'dotenv';
import express , {Express, Request, Response, NextFunction} from 'express';

import { request, Server, IncomingMessage} from 'http';
import {WebSocketServer} from 'ws';
import bodyParser from 'body-parser';
import cors from 'cors';
import redis, {RedisClientType, createClient} from 'redis';


dotenv.config();

const app : Express = express();

const redis_client : RedisClientType = createClient();


const lobbySocket : WebSocketServer = new WebSocketServer({noServer : true}) // server for the game lobby
const gameSocket : WebSocketServer  = new WebSocketServer({noServer : true})  // server for the game action

lobbySocket.on('connection', async (ws, req) => {
    ws.on('message', async (message) => {
        console.log(message.toString(), ws)
    })
})




const server : Server = app.listen(process.env.PORT, async () => {
    console.log('node server has started')
    await redis_client.connect();
    const game = await redis_client.get('game');  // get the game data from redis
    const users = await redis_client.get('users'); // get the user data from redis

    if (!(game && users)) {   // if the both of them do not exits 
        await redis_client.set('game', '[]');
        await redis_client.set('users', '[]')
    }   
    console.log('redis server connected');
});

server.on('upgrade', (request : IncomingMessage, socket, head) => {
    const pathname  : any = request.url;

    if (pathname === '/lobby' ) {
        lobbySocket.handleUpgrade(request, socket, head, ws => {
            lobbySocket.emit('connection', ws, request);
        });
    } else if (pathname === '/game') {
        gameSocket.handleUpgrade(request, socket, head, ws => {
            gameSocket.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
})
