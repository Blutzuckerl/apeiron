const path = require('path');
const fs = require('fs');
const { loadEnv } = require('../config/loadEnv');

loadEnv();

const host = process.env.HOST || process.env.PLAYWRIGHT_SERVER_HOST || '127.0.0.1';
const port = Number(process.env.PORT || process.env.HTTP_PORT || 3000);
const httpsPort = Number(process.env.HTTPS_PORT || 3443);
const dbPath = path.resolve(process.cwd(), process.env.DB_PATH || path.join('data', 'test.sqlite'));
const fixturePath = path.resolve(
  process.cwd(),
  process.env.PLAYWRIGHT_DB_FIXTURE || path.join('data', 'test-profile.sqlite')
);

process.env.HOST = host;
process.env.PORT = String(port);
process.env.HTTP_PORT = String(port);
process.env.HTTPS_PORT = String(httpsPort);
process.env.DB_PATH = dbPath;
process.env.APP_TEST_MODE = process.env.APP_TEST_MODE || '1';

[dbPath, `${dbPath}-wal`, `${dbPath}-shm`].forEach((filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
});

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

if (fs.existsSync(fixturePath)) {
  fs.copyFileSync(fixturePath, dbPath);
  [ '-wal', '-shm' ].forEach((suffix) => {
    const source = `${fixturePath}${suffix}`;
    const destination = `${dbPath}${suffix}`;
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, destination);
    }
  });
} else {
  require('../db/seed');
}

const { startServers } = require('../bootstrap/startServers');

startServers();
console.log(`Apeiron test server running on host ${host} (HTTP ${port}, HTTPS ${httpsPort}) using ${dbPath}`);
