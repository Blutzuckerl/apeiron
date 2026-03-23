const { loadEnv } = require('../config/loadEnv');
loadEnv();

const fs = require('fs');
const { dbPath } = require('./connection');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log(`Deleted ${dbPath}`);
}

console.log('Database reset complete. Run migrations + seed next.');
