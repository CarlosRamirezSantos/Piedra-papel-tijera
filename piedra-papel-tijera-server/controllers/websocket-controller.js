import { User, Game } from '../models/GameUser.js'; 
import jwt from 'jsonwebtoken';

export const socketController = async (socket, io) => {

    const token = socket.handshake.auth.token;
    let usuario = null;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'token_jugar');
        usuario = await User.findByPk(decoded.uid);
        
        if (!usuario) {
            return socket.disconnect();
        }
        
        socket.data.usuario = usuario;
        socket.join(`user-${usuario.id}`);
        console.log(`Jugador conectado: ${usuario.username}`);

    } catch (error) {
        return socket.disconnect();
    }

    const actualizarListaPartidas = async () => {
        const partidas = await Game.findAll({
            where: { status: 'WAITING', type: 'HUMAN' },
            include: [{ model: User, as: 'player1', attributes: ['username'] }]
        });
        io.emit('lista-partidas', partidas);
    };

    const actualizarRanking = async () => {
        const ranking = await User.findAll({
            order: [['gamesWon', 'DESC']],
            limit: 10,
            attributes: ['username', 'gamesWon', 'gamesPlayed']
        });
        io.emit('ranking', ranking);
    };

    actualizarListaPartidas();
    actualizarRanking();

    // CREAR PARTIDA
    socket.on('crear-partida', async (tipo) => {
        const nuevaPartida = await Game.create({
            player1Id: usuario.id,
            type: tipo,
            status: tipo === 'CPU' ? 'PLAYING' : 'WAITING'
        });

        const sala = `game-${nuevaPartida.id}`;
        socket.join(sala);
        socket.emit('partida-creada', nuevaPartida);

        if (tipo === 'HUMAN') {
            actualizarListaPartidas();
        } else {
            socket.emit('inicio-partida', nuevaPartida);
        }
    });

    // UNIRSE A PARTIDA
    socket.on('unirse-partida', async (gameId) => {
        const partida = await Game.findByPk(gameId);
        if (!partida || partida.status !== 'WAITING') return;

        partida.player2Id = usuario.id;
        partida.status = 'PLAYING';
        await partida.save();

        socket.join(`game-${gameId}`);
        io.to(`game-${gameId}`).emit('inicio-partida', partida);
        actualizarListaPartidas();
    });

    // JUGAR TURNO
    socket.on('realizar-jugada', async ({ gameId, jugada }) => {
        const partida = await Game.findByPk(gameId);
        
        if (partida.player1Id === usuario.id) partida.p1Move = jugada;
        else if (partida.player2Id === usuario.id) partida.p2Move = jugada;

        // Para jugar contra la máquina
        if (partida.type === 'CPU') {
            const opciones = ['PIEDRA', 'PAPEL', 'TIJERA'];
            partida.p2Move = opciones[Math.floor(Math.random() * 3)];
        }
        await partida.save();

        if (partida.p1Move && partida.p2Move) {
            let ganadorRonda = 'EMPATE';
            if (partida.p1Move !== partida.p2Move) {
                
                if (
                    (partida.p1Move === 'PIEDRA' && partida.p2Move === 'TIJERA') ||
                    (partida.p1Move === 'TIJERA' && partida.p2Move === 'PAPEL') ||
                    (partida.p1Move === 'PAPEL' && partida.p2Move === 'PIEDRA')
                ) {
                    ganadorRonda = 'P1';
                    partida.p1Score++;
                } else {
                    ganadorRonda = 'P2';
                    partida.p2Score++;
                }
            }

            // Enviar resultado ronda
            io.to(`game-${gameId}`).emit('resultado-ronda', {
                p1Move: partida.p1Move,
                p2Move: partida.p2Move,
                p1Score: partida.p1Score,
                p2Score: partida.p2Score,
                ganadorRonda
            });

            // Comprobamos si alguien ganó la partida al mejor de 3
            if (partida.p1Score === 3 || partida.p2Score === 3) {
                partida.status = 'FINISHED';
                partida.winnerId = partida.p1Score === 3 ? partida.player1Id : partida.player2Id;
                await partida.save();

                // Actualizamos stats del ganador
                const ganador = await User.findByPk(partida.winnerId);
                ganador.gamesWon++;
                ganador.gamesPlayed++; 
                await ganador.save();
                
                // Sumamos la partida jugada al que pierde
                const perdedorId = partida.p1Score === 3 ? partida.player2Id : partida.player1Id;
                if(perdedorId) { // Puede ser null si era CPU
                     const perdedor = await User.findByPk(perdedorId);
                     perdedor.gamesPlayed++;
                     await perdedor.save();
                }

                io.to(`game-${gameId}`).emit('fin-partida', { ganadorId: partida.winnerId });
                actualizarRanking();
            } else {
                // Limpiamos jugada para la siguiente ronda
                partida.p1Move = null;
                partida.p2Move = null;
                await partida.save();
            }
        }
    });
};