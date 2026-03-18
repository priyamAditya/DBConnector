import pg from "pg";

const pools = new Map();

function getPoolConfig(conn) {
  return {
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.username,
    password: conn.password,
    ssl: conn.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 5,
  };
}

export async function testPgConnection(conn) {
  const client = new pg.Client(getPoolConfig(conn));
  try {
    await client.connect();
    const res = await client.query("SELECT version()");
    return { success: true, version: res.rows[0].version };
  } finally {
    await client.end();
  }
}

function getPool(conn) {
  if (!pools.has(conn.name)) {
    pools.set(conn.name, new pg.Pool(getPoolConfig(conn)));
  }
  return pools.get(conn.name);
}

export async function runQuery(conn, sql) {
  const pool = getPool(conn);
  const result = await pool.query(sql);
  return {
    command: result.command,
    rowCount: result.rowCount,
    fields: result.fields?.map((f) => f.name) ?? [],
    rows: result.rows ?? [],
  };
}

export async function closePool(name) {
  const pool = pools.get(name);
  if (pool) {
    await pool.end();
    pools.delete(name);
  }
}
