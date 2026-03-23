import mysql from "mysql2/promise";

const pools = new Map();

function getConnConfig(conn) {
  return {
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.username,
    password: conn.password,
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10000,
  };
}

export async function testConnection(conn) {
  const connection = await mysql.createConnection(getConnConfig(conn));
  try {
    const [rows] = await connection.query("SELECT version() AS version");
    return { success: true, version: `MySQL ${rows[0].version}` };
  } finally {
    await connection.end();
  }
}

function getPool(conn) {
  if (!pools.has(conn.name)) {
    pools.set(
      conn.name,
      mysql.createPool({
        ...getConnConfig(conn),
        waitForConnections: true,
        connectionLimit: 5,
        idleTimeout: 30000,
      })
    );
  }
  return pools.get(conn.name);
}

export async function runQuery(conn, sql) {
  const pool = getPool(conn);
  const [rows, fields] = await pool.query(sql);

  // DDL/DML statements return OkPacket (no fields array)
  if (!Array.isArray(rows)) {
    return {
      command: "OK",
      rowCount: rows.affectedRows ?? 0,
      columns: [],
      rows: [],
    };
  }

  return {
    command: "SELECT",
    rowCount: rows.length,
    columns: fields?.map((f) => f.name) ?? [],
    rows,
  };
}

export async function closePool(name) {
  const pool = pools.get(name);
  if (pool) {
    await pool.end();
    pools.delete(name);
  }
}

export const defaultPort = 3306;
export const label = "MySQL";
