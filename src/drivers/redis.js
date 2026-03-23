import Redis from "ioredis";

const clients = new Map();

function getConnOptions(conn) {
  return {
    host: conn.host,
    port: conn.port,
    password: conn.password || undefined,
    db: parseInt(conn.database, 10) || 0,
    username: conn.username || undefined,
    tls: conn.ssl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10000,
    lazyConnect: true,
  };
}

export async function testConnection(conn) {
  const client = new Redis(getConnOptions(conn));
  try {
    await client.connect();
    const info = await client.info("server");
    const versionMatch = info.match(/redis_version:(\S+)/);
    const version = versionMatch ? versionMatch[1] : "unknown";
    return { success: true, version: `Redis ${version}` };
  } finally {
    client.disconnect();
  }
}

function getClient(conn) {
  if (!clients.has(conn.name)) {
    const client = new Redis(getConnOptions(conn));
    clients.set(conn.name, client);
  }
  return clients.get(conn.name);
}

export async function runQuery(conn, sql) {
  const client = getClient(conn);
  if (client.status === "wait") await client.connect();

  // Parse Redis command string, e.g. "GET mykey" or "HGETALL users:1"
  const parts = parseCommand(sql.trim());
  if (parts.length === 0) throw new Error("Empty command");

  const command = parts[0].toUpperCase();
  const args = parts.slice(1);

  const result = await client.call(command, ...args);

  // Format the result into a table-like structure
  return formatResult(command, result);
}

function parseCommand(input) {
  const parts = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function formatResult(command, result) {
  if (result === null || result === undefined) {
    return { command, rowCount: 0, columns: ["value"], rows: [{ value: "(nil)" }] };
  }

  if (typeof result === "string" || typeof result === "number") {
    return { command, rowCount: 1, columns: ["value"], rows: [{ value: result }] };
  }

  if (Array.isArray(result)) {
    // HGETALL-style: alternating key/value
    if (["HGETALL", "HSCAN", "CONFIG"].includes(command) && result.length % 2 === 0 && result.length > 0) {
      const rows = [];
      for (let i = 0; i < result.length; i += 2) {
        rows.push({ key: result[i], value: result[i + 1] });
      }
      return { command, rowCount: rows.length, columns: ["key", "value"], rows };
    }

    // Regular list
    const rows = result.map((v, i) => ({ index: i, value: typeof v === "object" ? JSON.stringify(v) : v }));
    return { command, rowCount: rows.length, columns: ["index", "value"], rows };
  }

  return { command, rowCount: 1, columns: ["value"], rows: [{ value: JSON.stringify(result) }] };
}

export async function closePool(name) {
  const client = clients.get(name);
  if (client) {
    client.disconnect();
    clients.delete(name);
  }
}

export const defaultPort = 6379;
export const label = "Redis";
