import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const DATA_DIR = join(homedir(), ".dbconnector");
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, "connections.sqlite");

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS connections (
    name        TEXT PRIMARY KEY,
    dbtype      TEXT NOT NULL DEFAULT 'postgres',
    host        TEXT NOT NULL,
    port        INTEGER NOT NULL DEFAULT 5432,
    database    TEXT NOT NULL,
    username    TEXT NOT NULL,
    password    TEXT NOT NULL,
    ssl         INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ── Migration: add dbtype column to existing databases ──────────────────────
try {
  const columns = db.prepare("PRAGMA table_info(connections)").all();
  const hasDbtype = columns.some((c) => c.name === "dbtype");
  if (!hasDbtype) {
    db.exec("ALTER TABLE connections ADD COLUMN dbtype TEXT NOT NULL DEFAULT 'postgres'");
  }
} catch {
  // column already exists, ignore
}

export function saveConnection({ name, dbtype, host, port, database, username, password, ssl }) {
  const stmt = db.prepare(`
    INSERT INTO connections (name, dbtype, host, port, database, username, password, ssl)
    VALUES (@name, @dbtype, @host, @port, @database, @username, @password, @ssl)
    ON CONFLICT(name) DO UPDATE SET
      dbtype=@dbtype, host=@host, port=@port, database=@database,
      username=@username, password=@password, ssl=@ssl
  `);
  stmt.run({
    name,
    dbtype: dbtype ?? "postgres",
    host,
    port: port ?? 5432,
    database,
    username,
    password,
    ssl: ssl ? 1 : 0,
  });
}

export function getConnection(name) {
  return db.prepare("SELECT * FROM connections WHERE name = ?").get(name);
}

export function listConnections() {
  return db
    .prepare("SELECT name, dbtype, host, port, database, username, ssl, created_at FROM connections ORDER BY name")
    .all();
}

export function removeConnection(name) {
  const info = db.prepare("DELETE FROM connections WHERE name = ?").run(name);
  return info.changes > 0;
}
