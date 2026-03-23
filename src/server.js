const { loadEnv } = require('./config/loadEnv');
loadEnv();

const { startServers } = require('./bootstrap/startServers');

startServers();
