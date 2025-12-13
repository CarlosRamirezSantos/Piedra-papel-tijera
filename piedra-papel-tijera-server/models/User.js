import { DataTypes } from 'sequelize';
import db from '../config/db.js';

const User = db.define('User', {
    username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    gamesPlayed: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    gamesWon: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
});

export default User;