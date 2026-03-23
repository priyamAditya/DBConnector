# DBConnector — Talk to Your Databases from Claude

DBConnector lets you connect your databases to **Claude** (or any AI that supports MCP).
Once connected, you can ask Claude to query your data, check tables, and more — using plain English.

**Supported databases:** PostgreSQL, MySQL, ClickHouse, MongoDB, Redis

---

## What You Need Before Starting

| Requirement | How to get it |
|---|---|
| **Node.js** (v18 or newer) | Go to [nodejs.org](https://nodejs.org), download the **LTS** version, and install it. Just click Next through the installer — all defaults are fine. |
| **Claude Desktop** | Download from [claude.ai/download](https://claude.ai/download) if you don't have it already. |
| **Your database credentials** | You'll need: host, port, database name, username, and password. Ask your team lead or DevOps if you're unsure. |

### How to check if Node.js is installed

Open your terminal (Mac: search "Terminal" in Spotlight; Windows: search "Command Prompt") and type:

```
node --version
```

If you see something like `v18.17.0` or higher, you're good. If you see an error, install Node.js from the link above.

---

## Setup (5 minutes)

### Step 1 — Download DBConnector

Open your terminal and run these two commands one by one:

```bash
git clone https://github.com/user/DBConnector.git
cd DBConnector
```

> **Don't have git?** You can also download the project as a ZIP from GitHub and unzip it.

### Step 2 — Install dependencies

Still in your terminal, run:

```bash
npm install
```

Wait for it to finish. You'll see some progress bars — that's normal.

### Step 3 — Connect it to Claude Desktop

Open this file in a text editor:

- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

> **Can't find the file?** Open Claude Desktop, go to **Settings → Developer → Edit Config**.

Add DBConnector to the `mcpServers` section. Replace `/FULL/PATH/TO/DBConnector` with the actual folder path where you downloaded DBConnector:

```json
{
  "mcpServers": {
    "dbconnector": {
      "command": "node",
      "args": ["/FULL/PATH/TO/DBConnector/src/index.js"]
    }
  }
}
```

**How to find the full path:**
- **Mac:** Open terminal, `cd` into the DBConnector folder, then type `pwd` — copy what it shows.
- **Windows:** Open the folder in File Explorer, click the address bar, and copy the path.

**Example (Mac):**
```json
{
  "mcpServers": {
    "dbconnector": {
      "command": "node",
      "args": ["/Users/yourname/Documents/DBConnector/src/index.js"]
    }
  }
}
```

**Example (Windows):**
```json
{
  "mcpServers": {
    "dbconnector": {
      "command": "node",
      "args": ["C:\\Users\\yourname\\Documents\\DBConnector\\src\\index.js"]
    }
  }
}
```

### Step 4 — Restart Claude Desktop

Quit Claude Desktop completely and open it again. You should see a small 🔌 icon or a tools indicator — that means DBConnector is connected.

---

## Using It

Once set up, just talk to Claude in plain English. Here are some examples:

### Adding a database connection

> "Add my production PostgreSQL database. Host is db.example.com, port 5432, database name is myapp, username admin, password secret123"

> "Connect to our Redis at cache.example.com, port 6379, password myredispass, call it prod-cache"

> "Add a MySQL connection called analytics — host is mysql.example.com, database reporting, user analyst, password pass456"

Claude will test the connection first and only save it if it works.

### Querying your data

> "Show me all tables in the prod database"

> "How many users signed up this month?"

> "What are the top 10 products by revenue?"

> "Get all keys matching 'session:*' from prod-cache"

### Managing connections

> "List all my saved connections"

> "Test if the staging connection still works"

> "Remove the old-prod connection"

---

## Supported Databases & Query Formats

### PostgreSQL & MySQL & ClickHouse

Use standard **SQL**:

```sql
SELECT * FROM users WHERE created_at > '2024-01-01' LIMIT 10
```

| Setting | PostgreSQL | MySQL | ClickHouse |
|---|---|---|---|
| Default port | 5432 | 3306 | 8123 |
| Query language | SQL | SQL | SQL |
| SSL | Supported | Supported | Supported |

### MongoDB

Queries use a **JSON format** (Claude will handle this for you when you ask in plain English):

```json
{
  "collection": "users",
  "action": "find",
  "filter": { "age": { "$gt": 21 } },
  "limit": 10
}
```

**Available actions:** `find`, `aggregate`, `countDocuments`, `insertOne`, `insertMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`

| Setting | Value |
|---|---|
| Default port | 27017 |
| SSL | Use SSL for MongoDB Atlas (cloud) |

### Redis

Use standard **Redis commands**:

```
GET mykey
HGETALL user:123
KEYS session:*
SET greeting "hello world"
```

| Setting | Value |
|---|---|
| Default port | 6379 |
| Database | A number from 0-15 (default: 0) |

---

## Connection Details Cheat Sheet

When adding a connection, you'll need these details. If you're not sure about any of them, ask your team lead or whoever manages your databases.

| Field | What it is | Example |
|---|---|---|
| **name** | A nickname you pick (anything you want) | `prod`, `staging`, `my-analytics` |
| **dbtype** | Which database software | `postgres`, `mysql`, `clickhouse`, `mongodb`, `redis` |
| **host** | The server address | `localhost`, `db.example.com`, `10.0.1.50` |
| **port** | The port number (auto-filled if you don't specify) | `5432`, `3306`, `6379` |
| **database** | The database name (or number for Redis) | `myapp`, `analytics`, `0` |
| **username** | Your database login | `admin`, `readonly_user` |
| **password** | Your database password | (keep this secret!) |
| **ssl** | Whether to use an encrypted connection | `true` for cloud databases, `false` for local |

---

## Interactive CLI (Optional)

DBConnector also comes with a menu-driven command-line tool for managing connections without Claude:

```bash
node src/cli.js
```

This gives you a visual menu to add, list, test, and remove connections. Useful for initial setup or debugging.

---

## Troubleshooting

### "Connection failed" when adding a database

- **Double-check your credentials** — host, port, username, password, database name.
- **Is the database running?** Ask your team if the server is up.
- **Firewall/VPN:** Some databases are only accessible from certain networks. Make sure you're on the right network or VPN.
- **SSL:** Cloud-hosted databases (like AWS RDS, MongoDB Atlas, Redis Cloud) usually need SSL turned on.

### Claude doesn't show the DBConnector tools

- Make sure you **restarted Claude Desktop** after editing the config file.
- Check that the path in `claude_desktop_config.json` is correct and points to the actual `src/index.js` file.
- Open your terminal and try running `node /FULL/PATH/TO/DBConnector/src/index.js` — if you see errors, something is wrong with the setup.

### "npm install" fails

- Make sure Node.js is installed (`node --version` should show v18+).
- Try deleting the `node_modules` folder and running `npm install` again:
  ```bash
  rm -rf node_modules
  npm install
  ```

### "Cannot find module" errors

- You may be running from the wrong folder. Make sure you're inside the DBConnector directory:
  ```bash
  cd /path/to/DBConnector
  node src/index.js
  ```

---

## Where Are My Connections Stored?

All saved connections are stored locally on your machine at:

```
~/.dbconnector/connections.sqlite
```

This is a small file in your home directory. Your credentials never leave your machine — they're only used to connect directly from your computer to the database.

---

## Using with Claude Code (CLI)

If you use Claude Code (the terminal version), add this to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "dbconnector": {
      "command": "node",
      "args": ["/FULL/PATH/TO/DBConnector/src/index.js"]
    }
  }
}
```

Then restart Claude Code. The database tools will be available automatically.

---

## Quick Reference

| What you want to do | What to say to Claude |
|---|---|
| Add a PostgreSQL database | "Add a postgres connection called prod — host db.example.com, database myapp, user admin, password secret" |
| Add a Redis cache | "Connect to Redis at localhost:6379, call it local-cache" |
| Add a MySQL database | "Add MySQL connection analytics — host mysql.example.com, database reports, user reader, password pass123" |
| See all connections | "List my database connections" |
| Query data | "Show me the last 10 orders from the prod database" |
| Test a connection | "Is the staging connection working?" |
| Remove a connection | "Delete the old-prod connection" |
