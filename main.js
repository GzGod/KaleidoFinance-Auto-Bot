// main.js
const { MiningCoordinator } = require('./miner.js');

// 开始挖矿过程
new MiningCoordinator().start().catch(console.error);
