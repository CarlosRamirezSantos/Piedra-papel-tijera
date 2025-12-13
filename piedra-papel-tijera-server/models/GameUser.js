import User from './User.js';
import Game from './Game.js';


User.hasMany(Game, { as: 'gamesAsP1', foreignKey: 'player1Id' });

User.hasMany(Game, { as: 'gamesAsP2', foreignKey: 'player2Id' });

Game.belongsTo(User, { as: 'player1', foreignKey: 'player1Id' });

Game.belongsTo(User, { as: 'player2', foreignKey: 'player2Id' });

export { User, Game };