import { createClient } from "@clickhouse/client";

const clients = new Map();

function makeClient(conn) {
  return createClient({
    url: `${conn.ssl ? "https" : "http"}://${conn.host}:${conn.port}`,
    username: conn.username,
    password: conn.password,
    database: conn.database,
    request_timeout: 10000,
    tls: conn.ssl ? { rejectUnauthorized: false } : undefined,
  });
}

export async function testConnection(conn) {
  const client = makeClient(conn);
  try {
    const result = await client.query({ query: "SELECT version() AS v", format: "JSONEachRow" });
    const rows = await result.json();
    return { success: true, version: `ClickHouse ${rows[0].v}` };
  } finally {
    await client.close();
  }
}

function getClient(conn) {
  if (!clients.has(conn.name)) {
    clients.set(conn.name, makeClient(conn));
  }
  return clients.get(conn.name);
}

export async function runQuery(conn, sql) {
  const client = getClient(conn);
  const trimmed = sql.trim().toUpperCase();
  const isSelect = trimmed.startsWith("SELECT") || trimmed.startsWith("SHOW") || trimmed.startsWith("DESCRIBE") || trimmed.startsWith("EXPLAIN");

  if (isSelect) {
    const result = await client.query({ query: sql, format: "JSONEachRow" });
    const rows = await result.json();
    return {
      command: "SELECT",
      rowCount: rows.length,
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rows,
    };
  }

  await client.command({ query: sql });
  return {
    command: "OK",
    rowCount: 0,
    columns: [],
    rows: [],
  };
}

export async function closePool(name) {
  const client = clients.get(name);
  if (client) {
    await client.close();
    clients.delete(name);
  }
}

export const defaultPort = 8123;
export const label = "ClickHouse";
