'use strict';

import dotenv from 'dotenv';
import express, { Express, Request, Response, NextFunction } from 'express';
import { request, Server, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import bodyParser from 'body-parser';
import cors from 'cors';
import redis, { RedisClientType, createClient } from 'redis';

interface myWebSocket extends WebSocket {
    id?: number  // adding id property for the web socket
}

interface GameObject {
    name: string,
    id: number,
    player1: number | null,
    player2: number | null,
    games_status: Array<string>
}

class Game {
    constructor(public game: GameObject) {
    }

    getPlayers() {
        return [this.game?.player1, this.game?.player2]
    }

    setPlayer(id: number) {
        if (this.game?.player1) {
            if (this.game?.player2) {
                return false
            } else {
                this.game.player2 = id
            }
        } else {
            this.game.player1 = id;
        }
        return true
    }

    async refresh() {
        const games = JSON.parse(String(await redis_client.get('game')));

        for (let game of games) {
            if (game.id === this.game.id) {
                games[games.indexOf(game)] = this.game;
                break;
            }
        }

        console.log(games, 3)

        await redis_client.set('game', JSON.stringify(games));
    }

    getGame() {
        return this.game
    }
}

dotenv.config();

const app: Express = express();

const redis_client: RedisClientType = createClient();


const lobbySocket: WebSocketServer = new WebSocketServer({ noServer: true }) // server for the game lobby
const gameSocket: WebSocketServer = new WebSocketServer({ noServer: true })  // server for the game action

lobbySocket.on('connection', async (ws, req) => {

    ws.on('message', async (message) => { // handle the creation of new games
        console.log(message.toString());
        const data = JSON.parse(message.toString());
        const games = JSON.parse(String(await redis_client.get('game')));


        if (data.type === 'game create') {
            console.log('creating a new game.................')
            let game_object: GameObject = { // creates a new game object
                name: data.name,
                id: await generateGameId(),
                player1: null,
                player2: null,
                games_status: ['', '', '', '', '', '', '', '', '']
            }

            games.push(game_object);

            await redis_client.set('game', JSON.stringify(games));

            ws.send(JSON.stringify({
                type: "new game",
                id: game_object.id
            }))
        }

    })

    ws.on('close', async () => { 
        console.log('closing socket for a client in the lobby');
    })
})

gameSocket.on('connection', async (ws: myWebSocket, req) => {
    console.log(req.url)
    const game_id = req.url?.split('/')[2]
    const games = JSON.parse(String(await redis_client.get('game')))


    const game = new Game(((): any => { // checks if the id is valid and returns the game with that id
        for (const game of games) {
            if (game.id == game_id) {
                return game;

            }
        }
        return null;
    })())

    console.log(game)

    if (game) {
        if (game.getPlayers().includes(null)) {
            if (!ws.id) {
                ws.id = await generateId() // give id to the player
            }
            if(game.setPlayer(ws.id)){
                await game.refresh();
                ws.send(JSON.stringify({
                    type : "game entrance",
                    game : game.getGame()
                }))

                if(game.getPlayers()[1]) {
                    sendMessage(gameSocket, game, {
                        type : "game entrance",
                        message : "game player complete",
                        game : game.getGame(),
                        isTurn : ws.id == game.getPlayers()[0]
                    })
                }
            }
        } else {
            ws.send(JSON.stringify({
                type: "full game"
            }));
            ws.close();
        }
    }
    ws.on('message', async (message) => {
        const data = JSON.parse(message.toString());

        if (data.type === "game update") {
            sendMessage(gameSocket, game, {
                type  : "game updated",
                status : data.status,
                isTurn : ws.id !== game.getPlayers()[countEmpty(data.status) % 2]
            })
        }

    })
})

function sendMessage(socket : WebSocketServer, game : Game, message : object) { // de
    for(const player of socket.clients) {
        const player_mod = player as myWebSocket
        if(game.getPlayers().includes(Number(player_mod.id))) {
            player_mod.send(
                JSON.stringify(message)
            )
        }
    }
}


function countEmpty(list : Array<string>) : number {
    let num : number = 0;
    list.forEach(x => {
        if(x === '') {
            num++;
        }
    })

    return num;
}

async function generateId(): Promise<number> {
    const users_json = await redis_client.get('users');
    const users = JSON.parse(String(users_json));
    let num: number;
    do {
        num = Math.floor(Math.random() * 10000);
    } while (users.includes(num));  // ensures the number is not in the user array

    users.push(num); // adds the number to the array
    await redis_client.set('users', JSON.stringify(users)); // sets the number back in the redis object

    return num;
}

async function generateGameId(): Promise<number> {
    const games = JSON.parse(String(await redis_client.get('game')));
    let num: number;
    do {
        num = Math.floor(Math.random() * 10000);
    } while (((): boolean => {
        let check: boolean = false;
        for (let { id } of games) {
            if (id == num) {
                check = true;
                break;
            }
        }
        return check
    })());

    return num;
}




const server: Server = app.listen(process.env.PORT, async () => {
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

server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const pathname: any = request.url;

    if (pathname === '/lobby') {
        lobbySocket.handleUpgrade(request, socket, head, ws => {
            lobbySocket.emit('connection', ws, request);
        });
    } else if (pathname.includes('/game')) {
        gameSocket.handleUpgrade(request, socket, head, ws => {
            gameSocket.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
})
