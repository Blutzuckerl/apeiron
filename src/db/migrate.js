const { loadEnv } = require('../config/loadEnv');
loadEnv();

const fs = require('fs');
const path = require('path');
const { db, dbPath } = require('./connection');

const migrationsDir = path.join(process.cwd(), 'migrations');

const ensureMigrationsTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

function ensureAiDmThreadSchema() {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ai_dm_threads'")
    .get();

  if (!table) {
    throw new Error(`Required table ai_dm_threads is missing in SQLite database: ${dbPath}`);
  }

  const columns = new Set(
    db.prepare('PRAGMA table_info(ai_dm_threads)').all().map((column) => column.name)
  );
  const requiredColumns = ['id', 'user_id', 'agent_key', 'thread_id', 'created_at'];

  for (const column of requiredColumns) {
    if (!columns.has(column)) {
      throw new Error(
        `Table ai_dm_threads in SQLite database ${dbPath} is missing required column: ${column}`
      );
    }
  }
}

function runMigrations() {
  ensureMigrationsTable();

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = new Set(db.prepare('SELECT filename FROM migrations').all().map((row) => row.filename));

  for (const filename of files) {
    if (applied.has(filename)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
    const txn = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(filename);
    });

    txn();
    console.log(`Applied migration: ${filename}`);
  }

  ensureAiDmThreadSchema();
  console.log('Migrations complete.');
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
