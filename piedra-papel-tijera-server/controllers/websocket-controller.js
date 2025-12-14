import { User, Game } from '../models/GameUser.js'; 
import jwt from 'jsonwebtoken';

export const socketController = async (socket, io) => {

    const token = socket.handshake.auth.token;
    let usuario = null;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'token_jugar');
        usuario = await User.findByPk(decoded.uid);
        
        if (!usuario) {
            console.log("Usuario no encontrado en BD");
            return socket.disconnect();
        }
        
        socket.data.usuario = usuario;
        socket.join(`user-${usuario.id}`);
        console.log(`🔌 Jugador conectado: ${usuario.username}`);

    } catch (error) {
        console.log("Error de token:", error.message);
        return socket.disconnect();
    }

    const actualizarListaPartidas = async () => {
        try {
            const partidas = await Game.findAll({
                where: { status: 'WAITING', type: 'HUMAN' },
                include: [{ model: User, as: 'player1', attributes: ['username'] }]
            });
            io.emit('lista-partidas', partidas);
        } catch (error) {
            console.error("Error actualizando lista:", error);
        }
    };

    const actualizarRanking = async () => {
        try {
            const ranking = await User.findAll({
                order: [['gamesWon', 'DESC']],
                limit: 10,
                attributes: ['username', 'gamesWon', 'gamesPlayed']
            });
            io.emit('ranking', ranking);
        } catch (error) {
            console.error("Error actualizando ranking:", error);
        }
    };

    actualizarListaPartidas();
    actualizarRanking();

    // CREAR PARTIDA 
    socket.on('crear-partida', async (tipo) => {
        console.log(`Crear partida (${tipo}) de ${usuario.username}`);
        
        try {
            const nuevaPartida = await Game.create({
                player1Id: usuario.id,
                type: tipo,
                status: tipo === 'CPU' ? 'PLAYING' : 'WAITING',
                p1Score: 0,
                p2Score: 0
            });

            const sala = `game-${nuevaPartida.id}`;
            socket.join(sala);
            
            socket.emit('partida-creada', nuevaPartida);

            if (tipo === 'HUMAN') {
                actualizarListaPartidas();
            } else {
               
                socket.emit('inicio-partida', nuevaPartida);
            }
        } catch (error) {
            console.error("Error al crear partida:", error);
        }
    });

    // UNIRSE A PARTIDA
    socket.on('unirse-partida', async (gameId) => {
        try {
            const partida = await Game.findByPk(gameId);
            if (!partida || partida.status !== 'WAITING') return;

            partida.player2Id = usuario.id;
            partida.status = 'PLAYING';
            await partida.save();

            socket.join(`game-${gameId}`);
            
            io.to(`game-${gameId}`).emit('inicio-partida', partida);
            
            actualizarListaPartidas();
        } catch (error) {
            console.error("Error al unirse:", error);
        }
    });
};