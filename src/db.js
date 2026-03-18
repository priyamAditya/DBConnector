import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import { homedir } from "os";

const DATA_DIR = join(homedir(), ".dbconnector");
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, "connections.sqlite");

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS connections (
    name        TEXT PRIMARY KEY,
    host        TEXT NOT NULL,
    port        INTEGER NOT NULL DEFAULT 5432,
    database    TEXT NOT NULL,
    username    TEXT NOT NULL,
    password    TEXT NOT NULL,
    ssl         INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

export function saveConnection({ name, host, port, database, username, password, ssl }) {
  const stmt = db.prepare(`
    INSERT INTO connections (name, host, port, database, username, password, ssl)
    VALUES (@name, @host, @port, @database, @username, @password, @ssl)
    ON CONFLICT(name) DO UPDATE SET
      host=@host, port=@port, database=@database,
      username=@username, password=@password, ssl=@ssl
  `);
  stmt.run({ name, host, port: port ?? 5432, database, username, password, ssl: ssl ? 1 : 0 });
}

export function getConnection(name) {
  return db.prepare("SELECT * FROM connections WHERE name = ?").get(name);
}

export function listConnections() {
  return db.prepare("SELECT name, host, port, database, username, ssl, created_at FROM connections ORDER BY name").all();
}

export function removeConnection(name) {
  const info = db.prepare("DELETE FROM connections WHERE name = ?").run(name);
  return info.changes > 0;
}
