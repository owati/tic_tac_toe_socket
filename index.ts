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

interface GameObject {
    id : number,
    player1 : number | null,
    player2 : number | null,
    games_status : Array<string>
}

dotenv.config();

const app : Express = express();

const redis_client : RedisClientType = createClient();


const lobbySocket : WebSocketServer = new WebSocketServer({noServer : true}) // server for the game lobby
const gameSocket : WebSocketServer  = new WebSocketServer({noServer : true})  // server for the game action

lobbySocket.on('connection', async (ws : myWebSocket, req) => {
    let games  =JSON.parse(String( await redis_client.get('game')));
    let users = JSON.parse(String(await redis_client.get('users')));

    if(!ws.id) { // the client is recognised by the server
        ws.id =  await generateId()
    }

    ws.send(JSON.stringify({ // sends the available games to the user
        type : "availablle games",
        games : games
    }));

    for(let client of lobbySocket.clients) { // send the new number of users to all clients
        users = JSON.parse(String(await redis_client.get('users'))) // refetch the user data

        client.send(JSON.stringify({
            type : "user number",
            users : users.length,
        }));
    }

    ws.on('message', async (message) => {
        const data = JSON.parse(message.toString());
        games = JSON.parse(String( await redis_client.get('game')));

        if(data.type === 'game create') {
            let game_object : GameObject = {
                id : await generateGameId(),
                player1 : null, 
                player2 : null,
                games_status : []
            }

            games.push(game_object);
            
        }
        
    })

    ws.on('close', async () => {  // the user id from the user array...
        console.log('closing socket for client ' + ws.id);
        users.splice(users.indexOf(ws.id),1);
        await redis_client.set('users', JSON.stringify(users));
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
        num = Math.floor(Math.random() * 10000);
    } while(users.includes(num));  // ensures the number is not in the user array

    users.push(num); // adds the number to the array
    await redis_client.set('users', JSON.stringify(users)); // sets the number back in the redis object

    return num;
}

async function generateGameId() : Promise<number> {
    const games = JSON.parse(String(await redis_client.get('game')));
    let num : number;
    do {
        num = Math.floor(Math.random() * 10000);
    } while((() : boolean => {
        let check : boolean = false;
        for (let {id} of games) {
            if(id == num)  {
                check = true;
                break;
            }
        }
        return check
    })());

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
