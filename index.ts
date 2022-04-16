import dotenv from 'dotenv';
import express , {Express, Request, Response, NextFunction} from 'express';
import expressWs, {Application, Instance, Router} from 'express-ws';
import bodyParser from 'body-parser';
import cors from 'cors';
import redis, {RedisClientType, createClient} from 'redis';

dotenv.config();

const wsInstance : Instance = expressWs(express())
const app : Application = wsInstance.app;
const router : Router  = express.Router();
const wss = wsInstance.getWss();

const client : RedisClientType = createClient()
client.connect(); // connect to redis server

app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json())
app.use(cors({
    origin : ''
}))

async function generateClientId() {
    const user: string | null = await client.get('user');
    if (typeof user === 'string') {
        let userArray : Array<string> = JSON.parse(user);
        return userArray.length;
    }

}

app.use(async (req : Request , res : Response, next: NextFunction) => { // connects to redis
    client.on('error', err => {
        console.log(err.message);
    })
    let games = await  client.get('games');
    let users = await client.get('user')
    if (!(games && users)) {  // creates the game and user redis objects if they do not yet exist
        await client.set('user', '[]'); // sets the user space 
        await client.set('games', "[]"); // sets the game space

    } 

    next();
})


app.get('/',  (req : Request, res : Response) => {  /// remove later
    console.log(req.headers)
    res.send('hello world')
})


wss.on('connection', function connection(ws, req) { // 

   // console.log(wsInstance.getWss().clients)
   
    ws.send('welcome')
})
wss.on('message', function connection(ws, req) { // 
    console.log(ws)
})

router.ws('/home', (ws, req : Request) => {
    
    ws.onmessage = (e) => {
        console.log(e)
    }
})


app.listen('3001', () => {
    console.log('node server has started...');
})