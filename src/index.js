#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  saveConnection,
  getConnection,
  listConnections,
  removeConnection,
} from "./db.js";
import { getDriver, DB_TYPES, DB_LABELS, DEFAULT_PORTS } from "./drivers/index.js";

const server = new McpServer(
  { name: "dbconnector", version: "2.0.0" },
  {
    capabilities: { tools: {} },
    instructions:
      "Multi-database connector. Supports PostgreSQL, MySQL, ClickHouse, MongoDB, and Redis. Add a named connection first with add_connection, then run queries with query.",
  }
);

const dbtypeEnum = z.enum(DB_TYPES).describe(
  "Database type: postgres, mysql, clickhouse, mongodb, or redis"
);

// ── Add / update a named connection ──────────────────────────────────────────
server.tool(
  "add_connection",
  "Save a new named database connection. Tests it before saving. Returns the server version on success.",
  {
    name: z.string().describe("Unique name for this connection (e.g. 'prod', 'staging')"),
    dbtype: dbtypeEnum,
    host: z.string().describe("Database host"),
    port: z.number().optional().describe("Port (auto-detected from db type if omitted)"),
    database: z.string().describe("Database name (for Redis, use the DB number like '0')"),
    username: z.string().describe("Database user"),
    password: z.string().default("").describe("Database password"),
    ssl: z.boolean().default(false).describe("Use SSL connection"),
  },
  async (args) => {
    const port = args.port ?? DEFAULT_PORTS[args.dbtype];
    const conn = { ...args, port };
    try {
      const driver = getDriver(args.dbtype);
      const result = await driver.testConnection(conn);
      saveConnection(conn);
      return {
        content: [
          {
            type: "text",
            text: `Connection "${args.name}" (${DB_LABELS[args.dbtype]}) saved successfully.\nServer: ${result.version}`,
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Connection failed: ${err.message}\nCredentials were NOT saved.`,
          },
        ],
      };
    }
  }
);

// ── Save credentials without testing ─────────────────────────────────────────
server.tool(
  "save_connection",
  "Save database credentials without testing the connection first. Useful when the database is not reachable right now but you want to store the credentials for later.",
  {
    name: z.string().describe("Unique name for this connection (e.g. 'prod', 'staging')"),
    dbtype: dbtypeEnum,
    host: z.string().describe("Database host"),
    port: z.number().optional().describe("Port (auto-detected from db type if omitted)"),
    database: z.string().describe("Database name (for Redis, use the DB number like '0')"),
    username: z.string().describe("Database user"),
    password: z.string().default("").describe("Database password"),
    ssl: z.boolean().default(false).describe("Use SSL connection"),
  },
  async (args) => {
    const port = args.port ?? DEFAULT_PORTS[args.dbtype];
    const conn = { ...args, port };
    try {
      saveConnection(conn);
      return {
        content: [
          {
            type: "text",
            text: `Connection "${args.name}" (${DB_LABELS[args.dbtype]}) saved.\nNote: Connection was NOT tested. Use test_connection to verify it works.`,
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Failed to save: ${err.message}`,
          },
        ],
      };
    }
  }
);

// ── List saved connections ───────────────────────────────────────────────────
server.tool(
  "list_connections",
  "List all saved database connections (passwords are hidden).",
  {},
  async () => {
    const conns = listConnections();
    if (conns.length === 0) {
      return {
        content: [
          { type: "text", text: "No connections saved yet. Use add_connection to add one." },
        ],
      };
    }
    const table = conns.map((c) => ({
      name: c.name,
      type: c.dbtype ?? "postgres",
      host: c.host,
      port: c.port,
      database: c.database,
      user: c.username,
      ssl: !!c.ssl,
      created: c.created_at,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(table, null, 2) }],
    };
  }
);

// ── Test an existing connection ──────────────────────────────────────────────
server.tool(
  "test_connection",
  "Test a saved connection by name.",
  {
    name: z.string().describe("Connection name to test"),
  },
  async ({ name }) => {
    const conn = getConnection(name);
    if (!conn) {
      return {
        isError: true,
        content: [{ type: "text", text: `Connection "${name}" not found.` }],
      };
    }
    try {
      const driver = getDriver(conn.dbtype ?? "postgres");
      const result = await driver.testConnection(conn);
      return {
        content: [
          { type: "text", text: `Connection "${name}" (${DB_LABELS[conn.dbtype ?? "postgres"]}) is healthy.\nServer: ${result.version}` },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Connection "${name}" failed: ${err.message}` }],
      };
    }
  }
);

// ── Execute a query ──────────────────────────────────────────────────────────
server.tool(
  "query",
  "Execute a query on a named connection. For SQL databases use SQL. For MongoDB use JSON (see docs). For Redis use native commands like 'GET key'.",
  {
    connection: z.string().describe("Name of the saved connection to use"),
    sql: z.string().describe("Query to execute (SQL for relational DBs, JSON for MongoDB, Redis commands for Redis)"),
  },
  async ({ connection, sql }) => {
    const conn = getConnection(connection);
    if (!conn) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Connection "${connection}" not found. Use list_connections to see available connections or add_connection to create one.`,
          },
        ],
      };
    }
    try {
      const driver = getDriver(conn.dbtype ?? "postgres");
      const result = await driver.runQuery(conn, sql);
      const output = {
        command: result.command,
        rowCount: result.rowCount,
        columns: result.columns,
        rows: result.rows,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Query error: ${err.message}` }],
      };
    }
  }
);

// ── Remove a connection ──────────────────────────────────────────────────────
server.tool(
  "remove_connection",
  "Remove a saved connection by name.",
  {
    name: z.string().describe("Connection name to remove"),
  },
  async ({ name }) => {
    const conn = getConnection(name);
    if (conn) {
      const driver = getDriver(conn.dbtype ?? "postgres");
      await driver.closePool(name);
    }
    const removed = removeConnection(name);
    return {
      content: [
        {
          type: "text",
          text: removed
            ? `Connection "${name}" removed.`
            : `Connection "${name}" not found.`,
        },
      ],
    };
  }
);

// ── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("DBConnector MCP server running on stdio");
