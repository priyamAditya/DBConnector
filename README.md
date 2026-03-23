# DBConnector — Talk to Your Databases from Claude

DBConnector lets you connect your databases to **Claude** (or any AI that supports MCP).
Once connected, you can ask Claude to query your data, check tables, and more — using plain English.

**Supported databases:** PostgreSQL, MySQL, ClickHouse, MongoDB, Redis

---

## Quick Start (3 commands)

### 1. Install Node.js (if you don't have it)

Go to [nodejs.org](https://nodejs.org), download the **LTS** version, install it. All defaults are fine.

To check if it's already installed, open your terminal and type:
```
node --version
```
If you see `v18` or higher, you're good.

> **Where is the terminal?**
> - **Mac:** Press `Cmd + Space`, type "Terminal", hit Enter
> - **Windows:** Press `Win`, type "Command Prompt", hit Enter

### 2. Download and install DBConnector

```bash
git clone https://github.com/priyamAditya/DBConnector.git
cd DBConnector
npm install
```

> **Don't have git?** Download the ZIP from GitHub, unzip it, then open terminal in that folder and run `npm install`.

### 3. Run the setup wizard

```bash
npm run setup
```

That's it. The wizard will:
- Auto-detect your Claude Desktop installation
- Configure everything for you
- Optionally let you add your first database connection right away

**After setup, restart Claude Desktop** and you're ready to go.

---

## Setup Options

### Automatic (recommended)

`npm run setup` handles everything. It detects your OS (Mac/Windows/Linux) and updates the Claude config automatically.

### Manual

If you prefer to configure manually, choose "Show me manual instructions" in the setup wizard, or follow these steps:

**For Claude Desktop:**

Open this file in a text editor:
- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

> **Tip:** In Claude Desktop, go to **Settings > Developer > Edit Config** to open it directly.

Add DBConnector to the config (replace the path with your actual path):

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

To find the full path: open terminal, `cd` into the DBConnector folder, type `pwd` (Mac/Linux) or look at the address bar in File Explorer (Windows).

**For Claude Code (CLI):**

Run `npm run setup` and pick "Claude Code — this project", or add this to `.mcp.json` in your project:

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

---

## Using It

Once set up, just talk to Claude in plain English.

### Adding a database connection

> "Add my production PostgreSQL database. Host is db.example.com, port 5432, database name is myapp, username admin, password secret123"

> "Connect to our Redis at cache.example.com, port 6379, password myredispass, call it prod-cache"

> "Save credentials for our MySQL analytics DB — host mysql.example.com, database reporting, user analyst, password pass456. Don't test it yet."

Claude will test the connection before saving by default. If you say "save" or "don't test", it stores the credentials without testing — handy when the database isn't reachable from your machine right now.

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

### PostgreSQL, MySQL & ClickHouse

Standard **SQL**:

```sql
SELECT * FROM users WHERE created_at > '2024-01-01' LIMIT 10
```

| | PostgreSQL | MySQL | ClickHouse |
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

Standard **Redis commands**:

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

When adding a connection, you'll need these details. Ask your team lead or DevOps if you're unsure.

| Field | What it is | Example |
|---|---|---|
| **name** | A nickname you pick (anything you want) | `prod`, `staging`, `my-analytics` |
| **dbtype** | Which database software | `postgres`, `mysql`, `clickhouse`, `mongodb`, `redis` |
| **host** | The server address | `localhost`, `db.example.com`, `10.0.1.50` |
| **port** | The port number (auto-filled if you skip it) | `5432`, `3306`, `6379` |
| **database** | The database name (or number for Redis) | `myapp`, `analytics`, `0` |
| **username** | Your database login | `admin`, `readonly_user` |
| **password** | Your database password | (keep this secret!) |
| **ssl** | Whether to use an encrypted connection | `true` for cloud databases, `false` for local |

---

## CLI Connection Manager (Optional)

Manage connections interactively from the terminal — no Claude needed:

```bash
npm run manage
```

This gives you a visual menu to add, list, test, and remove connections.

---

## Troubleshooting

### "Connection failed" when adding a database

- **Double-check your credentials** — host, port, username, password, database name.
- **Is the database running?** Ask your team if the server is up.
- **Firewall/VPN:** Some databases are only accessible from certain networks.
- **SSL:** Cloud databases (AWS RDS, MongoDB Atlas, Redis Cloud) usually need SSL on.
- **Save without testing:** You can tell Claude "save the credentials without testing" to store them now and test later.

### Claude doesn't show the DBConnector tools

- **Restart Claude Desktop** after running `npm run setup`.
- Run `npm run setup` again to verify the config is correct.
- Try running `node src/index.js` in your terminal — if you see errors, something went wrong with `npm install`.

### "npm install" fails

- Make sure Node.js is installed: `node --version` should show v18+.
- Try a fresh install:
  ```bash
  rm -rf node_modules
  npm install
  ```

### "Cannot find module" errors

Make sure you're running commands from inside the DBConnector folder:
```bash
cd /path/to/DBConnector
npm run setup
```

---

## Where Are My Connections Stored?

Locally on your machine at `~/.dbconnector/connections.sqlite`. Your credentials never leave your machine — they're only used to connect directly to the database.

---

## Quick Reference

| What you want to do | What to say to Claude |
|---|---|
| Add a PostgreSQL database | "Add a postgres connection called prod — host db.example.com, database myapp, user admin, password secret" |
| Add a Redis cache | "Connect to Redis at localhost:6379, call it local-cache" |
| Add a MySQL database | "Add MySQL connection analytics — host mysql.example.com, database reports, user reader, password pass123" |
| Save credentials without testing | "Save credentials for staging postgres at db-staging.example.com, don't test it yet" |
| See all connections | "List my database connections" |
| Query data | "Show me the last 10 orders from the prod database" |
| Test a connection | "Is the staging connection working?" |
| Remove a connection | "Delete the old-prod connection" |

---

## All Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (first time only) |
| `npm run setup` | Configure Claude Desktop or Claude Code |
| `npm run manage` | Open the interactive connection manager |
| `npm start` | Start the MCP server (Claude does this automatically) |
