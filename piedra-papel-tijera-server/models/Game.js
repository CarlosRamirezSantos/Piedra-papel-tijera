import { DataTypes } from 'sequelize';
import db from '../config/db.js';

const Game = db.define('Game', {

    player1Id: { type: DataTypes.INTEGER, allowNull: false },
    player2Id: { type: DataTypes.INTEGER, allowNull: true }, // Puede ser null al principio si espera rival
    winnerId: { type: DataTypes.INTEGER, allowNull: true },

    type: { 
        type: DataTypes.ENUM('HUMAN', 'CPU'), 
        allowNull: false 
    },
    status: { 
        type: DataTypes.ENUM('WAITING', 'PLAYING', 'FINISHED'), 
        defaultValue: 'WAITING' 
    },
    
    p1Score: { type: DataTypes.INTEGER, defaultValue: 0 },
    p2Score: { type: DataTypes.INTEGER, defaultValue: 0 },
    currentRound: { type: DataTypes.INTEGER, defaultValue: 1 },

    p1Move: { type: DataTypes.STRING, allowNull: true }, // 'PIEDRA', 'PAPEL', 'TIJERA'
    p2Move: { type: DataTypes.STRING, allowNull: true }
});

export default Game;