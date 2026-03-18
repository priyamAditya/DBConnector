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
import { testPgConnection, runQuery, closePool } from "./pg.js";

const server = new McpServer(
  { name: "dbconnector", version: "1.0.0" },
  {
    capabilities: { tools: {} },
    instructions:
      "PostgreSQL database connector. Add a named connection first with add_connection, then run queries with query.",
  }
);

// ── Add / update a named connection ──────────────────────────────────────────
server.tool(
  "add_connection",
  "Save a new named PostgreSQL connection. Tests it before saving. Returns the server version on success.",
  {
    name: z.string().describe("Unique name for this connection (e.g. 'prod', 'staging')"),
    host: z.string().describe("PostgreSQL host"),
    port: z.number().default(5432).describe("PostgreSQL port"),
    database: z.string().describe("Database name"),
    username: z.string().describe("Database user"),
    password: z.string().describe("Database password"),
    ssl: z.boolean().default(false).describe("Use SSL connection"),
  },
  async (args) => {
    try {
      const result = await testPgConnection(args);
      saveConnection(args);
      return {
        content: [
          {
            type: "text",
            text: `Connection "${args.name}" saved successfully.\nServer: ${result.version}`,
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

// ── List saved connections ───────────────────────────────────────────────────
server.tool(
  "list_connections",
  "List all saved PostgreSQL connections (passwords are hidden).",
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
      const result = await testPgConnection(conn);
      return {
        content: [
          { type: "text", text: `Connection "${name}" is healthy.\nServer: ${result.version}` },
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

// ── Execute a SQL query ──────────────────────────────────────────────────────
server.tool(
  "query",
  "Execute a SQL query on a named connection. The connection must be saved first via add_connection.",
  {
    connection: z.string().describe("Name of the saved connection to use"),
    sql: z.string().describe("SQL query to execute"),
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
      const result = await runQuery(conn, sql);
      const output = {
        command: result.command,
        rowCount: result.rowCount,
        columns: result.fields,
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
    await closePool(name);
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
