import express , {Express, Request, Response} from 'express';
import expressWs, {Application, Instance, Router} from 'express-ws';

const wsInstance : Instance = expressWs(express())
const app : Application = wsInstance.app;
const router : Router  = express.Router();


app.get('/',  (req : Request, res : Response) => {
    console.log(req.headers)
    res.send('hello world')
})

wsInstance.getWss().on('connection', function connection(ws) {

    console.log(wsInstance.getWss().clients)
    ws.send('welcome')
})

router.ws('/home', (ws, req : Request) => {
    ws.on('message', () => {
        console.log(wsInstance.getWss().clients)
    })
})


app.listen('3001', () => {
    console.log('node server has started...');
})