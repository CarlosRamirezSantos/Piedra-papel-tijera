import { User, Game } from "../models/GameUser.js";
import jwt from "jsonwebtoken";

export const socketController = async (socket, io) => {
  const token = socket.handshake.auth.token;
  let usuario = null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "token_jugar");
    usuario = await User.findByPk(decoded.uid);

    if (!usuario) {
      console.log("Usuario no encontrado en BD");
      return socket.disconnect();
    }

    socket.data.usuario = usuario;
    socket.join(`user-${usuario.id}`);
    console.log(`Jugador conectado: ${usuario.username}`);
  } catch (error) {
    console.log("Error de token:", error.message);
    return socket.disconnect();
  }

  const actualizarListaPartidas = async () => {
    try {
      const partidas = await Game.findAll({
        where: { status: "WAITING", type: "HUMAN" },
        include: [{ model: User, as: "player1", attributes: ["username"] }],
      });
      io.emit("lista-partidas", partidas);
    } catch (error) {
      console.error("Error actualizando lista:", error);
    }
  };

  const actualizarRanking = async () => {
    try {
      const ranking = await User.findAll({
        order: [["gamesWon", "DESC"]],
        limit: 10,
        attributes: ["username", "gamesWon", "gamesPlayed"],
      });
      io.emit("ranking", ranking);
    } catch (error) {
      console.error("Error actualizando ranking:", error);
    }
  };

  // Para actualizar estadísticas
  const actualizarStats = async (userId, esGanador) => {
    if (!userId) return;
    try {
      const user = await User.findByPk(userId);
      if (user) {
        user.gamesPlayed += 1;
        if (esGanador) user.gamesWon += 1;
        await user.save();
      }
    } catch (e) {
      console.error("Error actualizando stats:", e);
    }
  };

  actualizarListaPartidas();
  actualizarRanking();

  // Para crear partida
  socket.on("crear-partida", async (tipo) => {
    console.log(`Crear partida (${tipo}) de ${usuario.username}`);

    try {
      const nuevaPartida = await Game.create({
        player1Id: usuario.id,
        type: tipo,
        status: tipo === "CPU" ? "PLAYING" : "WAITING",
        p1Score: 0,
        p2Score: 0,
      });

      const sala = `game-${nuevaPartida.id}`;
      socket.join(sala);

      socket.emit("partida-creada", nuevaPartida);

      if (tipo === "HUMAN") {
        actualizarListaPartidas();
      } else {
        socket.emit("inicio-partida", nuevaPartida);
      }
    } catch (error) {
      console.error("Error al crear partida:", error);
    }
  });

  // Para unirse a partida
  socket.on("unirse-partida", async (gameId) => {
    try {
      const partida = await Game.findByPk(gameId);
      if (!partida || partida.status !== "WAITING") return;

      if (partida.player1Id === usuario.id) {
        return;
      }

      partida.player2Id = usuario.id;
      partida.status = "PLAYING";
      await partida.save();

      socket.join(`game-${gameId}`);

      io.to(`game-${gameId}`).emit("inicio-partida", partida);

      actualizarListaPartidas();
    } catch (error) {
      console.error("Error al unirse:", error);
    }
  });

  // Lógica del juego
  socket.on("realizar-jugada", async ({ gameId, jugada }) => {
    try {
      const partida = await Game.findByPk(gameId);
      if (!partida || partida.status !== "PLAYING") return;

      if (partida.player1Id === usuario.id) partida.p1Move = jugada;
      else if (partida.player2Id === usuario.id) partida.p2Move = jugada;
      else return;

      if (partida.type === "CPU") {
        const moves = ["PIEDRA", "PAPEL", "TIJERA"];
        partida.p2Move = moves[Math.floor(Math.random() * 3)];
      }
      await partida.save();

      if (partida.p1Move && partida.p2Move) {
        let ganadorRonda = "EMPATE";
        const p1 = partida.p1Move;
        const p2 = partida.p2Move;

        if (p1 !== p2) {
          if (
            (p1 === "PIEDRA" && p2 === "TIJERA") ||
            (p1 === "PAPEL" && p2 === "PIEDRA") ||
            (p1 === "TIJERA" && p2 === "PAPEL")
          ) {
            ganadorRonda = "P1";
            partida.p1Score += 1;
          } else {
            ganadorRonda = "P2";
            partida.p2Score += 1;
          }
        }

        io.to(`game-${gameId}`).emit("resultado-ronda", {
          p1Move: p1,
          p2Move: p2,
          p1Score: partida.p1Score,
          p2Score: partida.p2Score,
          ganadorRonda,
        });

        // Ganador al mejor de 
        if (partida.p1Score >= 3 || partida.p2Score >= 3) {
          partida.status = "FINISHED";
          partida.winnerId =
            partida.p1Score >= 3 ? partida.player1Id : partida.player2Id;
          await partida.save();

          await actualizarStats(partida.winnerId, true);
          const loserId =
            partida.winnerId === partida.player1Id
              ? partida.player2Id
              : partida.player1Id;
          await actualizarStats(loserId, false);

          io.to(`game-${gameId}`).emit("fin-partida", {
            ganadorId: partida.winnerId,
          });
          actualizarRanking();
        } else {
          partida.p1Move = null;
          partida.p2Move = null;
          await partida.save();
        }
      }
    } catch (error) {
      console.error("Error jugada:", error);
    }
  });

  // Para abandonar partida
  socket.on("abandonar-partida", async (gameId) => {
    try {
      const partida = await Game.findByPk(gameId);
      if (!partida) return;

      if (partida.status === "WAITING") {
        await partida.destroy();
        console.log(`Partida #${gameId} en WAITING eliminada por abandono.`);
        socket.emit("fin-partida", { ganadorId: null });
      } else if (partida.status === "PLAYING") {
        partida.status = "FINISHED";

        let winnerId = null;
        let loserId = usuario.id;

        if (partida.type !== "CPU") {
          winnerId =
            partida.player1Id === usuario.id
              ? partida.player2Id
              : partida.player1Id;
        }

        partida.winnerId = winnerId;
        await partida.save();

        await actualizarStats(loserId, false);
        if (winnerId) await actualizarStats(winnerId, true);

        io.to(`game-${gameId}`).emit("fin-partida", {
          ganadorId: winnerId || "CPU",
        });
        actualizarRanking();
      }
      
      actualizarListaPartidas();
    } catch (error) {
      console.error("Error al gestionar abandono:", error);
    }
  });
};