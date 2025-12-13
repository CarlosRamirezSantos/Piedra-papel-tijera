import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import kleur from 'kleur';
import db from '../config/db.js';
import authRoutes from '../routes/authRoutes.js';
import { socketController } from '../controllers/websocket-controller.js';


class MiServer {

    constructor() {
        this.app = express();
        this.port = process.env.PORT || 8090;
        this.authPath = '/api/auth';
        this.server = createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: '*', 
                methods: ['GET', 'POST']
            }
        });

        this.conectarDB();

        this.middlewares();

        this.routes();

        this.sockets();
    }

    async conectarDB() {
        try {
            await db.authenticate();
            await db.sync({ force: false }); 
            console.log(kleur.green().bold('Base de datos conectada y sincronizada'));
        } catch (error) {
            console.error(kleur.red().bold('Error conectando a la BD:'), error);
        }
    }

    middlewares() {

        this.app.use(cors());

        this.app.use(express.json());
    
        this.app.use(express.static('public'));
    }

    routes() {
        this.app.use(this.authPath, authRoutes);
    }

    sockets() {
        this.io.on('connection', (socket) => {
            
            socketController(socket, this.io);
        });
    }

    listen() {
        this.server.listen(this.port, () => {
            console.log(kleur.blue().bold(`Servidor corriendo en puerto ${this.port}`));
        });
    }
}

export { MiServer };