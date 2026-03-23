const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { loadEnv } = require('../config/loadEnv');

loadEnv();

function resolveDbPath() {
  const configuredPath = String(process.env.DB_PATH || process.env.DATABASE_URL || '').trim();
  if (!configuredPath) {
    return path.join(process.cwd(), 'data', 'apeiron.db');
  }

  let normalized = configuredPath;
  if (normalized.startsWith('sqlite:') || normalized.startsWith('file:')) {
    normalized = normalized.replace(/^(sqlite|file):/, '');
    if (normalized.startsWith('//')) {
      normalized = normalized.replace(/^\/+/, '/');
    }
  }

  if (normalized === ':memory:' || normalized === 'file::memory:') {
    throw new Error('In-memory SQLite is not supported. Use DB_PATH or DATABASE_URL with a persistent file path.');
  }

  return path.isAbsolute(normalized)
    ? normalized
    : path.resolve(process.cwd(), normalized);
}

const dbPath = resolveDbPath();
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

process.env.DB_PATH = dbPath;
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

module.exports = { db, dbPath };
