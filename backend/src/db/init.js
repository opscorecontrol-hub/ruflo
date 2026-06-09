import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH || `${__dirname}/../../../data/opscore.db`;

let db = null;
let writeChain = Promise.resolve();

export async function initDb() {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys=ON;');

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS monitors (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    interval_s INTEGER DEFAULT 60,
    status TEXT DEFAULT 'active',
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS checks (
    id TEXT PRIMARY KEY,
    monitor_id TEXT,
    status TEXT,
    response_time INTEGER,
    status_code INTEGER,
    error TEXT,
    checked_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    monitor_id TEXT,
    type TEXT,
    message TEXT,
    created_at INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    monitor_id TEXT,
    started_at INTEGER,
    resolved_at INTEGER,
    root_cause TEXT
  )`);

  saveDb();
  setInterval(saveDb, 30000);
}

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

export function writeQueue(fn) {
  const next = writeChain.then(() => fn()).catch((err) => {
    console.error('[writeQueue] error:', err);
    throw err;
  });
  writeChain = next.catch(() => {});
  return next;
}

export function runQuery(sql, params = []) {
  return getDb().run(sql, params);
}

export function getOne(sql, params = []) {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function getAll(sql, params = []) {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}
