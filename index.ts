'use strict';

import dotenv from 'dotenv';
import express , {Express, Request, Response, NextFunction} from 'express';
import { request, Server, IncomingMessage} from 'http';
import {WebSocketServer, WebSocket} from 'ws';
import bodyParser from 'body-parser';
import cors from 'cors';
import redis, {RedisClientType, createClient} from 'redis';

interface myWebSocket extends WebSocket {
    id?: number  // adding id property for the web socket
}

dotenv.config();

const app : Express = express();

const redis_client : RedisClientType = createClient();


const lobbySocket : WebSocketServer = new WebSocketServer({noServer : true}) // server for the game lobby
const gameSocket : WebSocketServer  = new WebSocketServer({noServer : true})  // server for the game action

lobbySocket.on('connection', async (ws : myWebSocket, req) => {
    const games_json  = await redis_client.get('game');
    const user_json = await redis_client.get('users');
    const games = JSON.parse(String(games_json));
    const users = JSON.parse(String(user_json));


    if(!ws.id) { // the client is recognised by the server
        ws.id =  await generateId()
    }

    ws.send(JSON.stringify({ // sends the available games to the user
        games : games
    }));

    for(let client of lobbySocket.clients) { // send the new number of users to all clients
        client.send(JSON.stringify({
            users : users.length
        }));
    }

    ws.on('message', async (message) => {
        const data = JSON.parse(message.toString());
        console.log(data, games, users );
    })
})

gameSocket.on('connection', async (ws, req) =>  {
    ws.on('message', async (message) => {
        const data = JSON.parse(message.toString());
        console.log(data);
    } )
})


async function generateId () : Promise<number> {
    const users_json = await redis_client.get('users');
    const users = JSON.parse(String(users_json));
    let num : number;
    do {
        num = Math.random() * 10000;
    } while(users.includes(num));  // ensures the number is not in the user array

    users.push(num); // adds the number to the array
    await redis_client.set('users', JSON.stringify(users)); // sets the number back in the redis object

    return num;
}




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
