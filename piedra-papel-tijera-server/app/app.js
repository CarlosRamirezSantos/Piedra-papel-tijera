import { MiServer } from './server.js';
import dotenv from 'dotenv';

dotenv.config();

const server = new MiServer();
server.listen();