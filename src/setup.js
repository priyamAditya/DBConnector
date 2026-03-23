#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir, platform } from "os";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import chalk from "chalk";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const INDEX_JS = join(PROJECT_ROOT, "src", "index.js");

// ── Detect Claude Desktop config path per OS ────────────────────────────────
function getClaudeDesktopConfigPath() {
  const os = platform();
  if (os === "darwin") {
    return join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  if (os === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  }
  // Linux
  return join(homedir(), ".config", "Claude", "claude_desktop_config.json");
}

// ── Detect Claude Code config paths ─────────────────────────────────────────
function getClaudeCodeConfigPaths() {
  return {
    project: join(process.cwd(), ".mcp.json"),
    global: join(homedir(), ".claude.json"),
  };
}

// ── Safely read and parse JSON, returning {} if missing/broken ──────────────
function readJsonSafe(path) {
  try {
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return null;
  }
}

// ── Write JSON with pretty formatting ───────────────────────────────────────
function writeJson(path, data) {
  const dir = join(path, "..");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ── Inject dbconnector into an MCP config object ────────────────────────────
function injectMcpServer(config) {
  config = config || {};
  config.mcpServers = config.mcpServers || {};

  const already = config.mcpServers.dbconnector;
  config.mcpServers.dbconnector = {
    command: "node",
    args: [INDEX_JS],
  };

  return { config, wasAlreadyConfigured: !!already };
}

// ── Banner ──────────────────────────────────────────────────────────────────
const banner = `
${chalk.bold.cyan("╔══════════════════════════════════════════╗")}
${chalk.bold.cyan("║")}   ${chalk.bold.white("DBConnector")} ${chalk.dim("— Setup Wizard")}            ${chalk.bold.cyan("║")}
${chalk.bold.cyan("╚══════════════════════════════════════════╝")}
`;

console.log(banner);

// ── Step 1: Choose what to configure ────────────────────────────────────────
const desktopPath = getClaudeDesktopConfigPath();
const codePaths = getClaudeCodeConfigPaths();

const targets = [];

const desktopExists = existsSync(desktopPath);
const desktopDirExists = existsSync(join(desktopPath, ".."));

targets.push({
  name: `Claude Desktop${desktopExists ? chalk.green(" (config found)") : desktopDirExists ? chalk.yellow(" (config will be created)") : chalk.dim(" (not installed)")}`,
  value: "desktop",
  checked: desktopExists || desktopDirExists,
});

targets.push({
  name: `Claude Code — this project (${chalk.dim(".mcp.json")})`,
  value: "code-project",
  checked: false,
});

targets.push({
  name: `Skip auto-setup — show me manual instructions`,
  value: "manual",
  checked: false,
});

const { selected } = await inquirer.prompt([
  {
    type: "list",
    name: "selected",
    message: "Where do you want to configure DBConnector?",
    choices: targets,
  },
]);

// ── Manual instructions ─────────────────────────────────────────────────────
if (selected === "manual") {
  console.log(chalk.bold("\n  Manual Setup Instructions\n"));
  console.log(chalk.dim("  For Claude Desktop, add this to your config file:"));
  console.log(chalk.dim(`  ${desktopPath}\n`));
  console.log(chalk.white(`  {
    "mcpServers": {
      "dbconnector": {
        "command": "node",
        "args": ["${INDEX_JS}"]
      }
    }
  }`));
  console.log(chalk.dim("\n  For Claude Code, add the same to .mcp.json in your project.\n"));
  console.log(chalk.dim("  Then restart Claude Desktop / Claude Code.\n"));
  process.exit(0);
}

// ── Auto-configure Claude Desktop ───────────────────────────────────────────
if (selected === "desktop") {
  const existing = readJsonSafe(desktopPath);
  if (existing === null && !desktopDirExists) {
    console.log(chalk.red("\n  Claude Desktop doesn't appear to be installed."));
    console.log(chalk.dim(`  Expected config at: ${desktopPath}`));
    console.log(chalk.dim("  Install Claude Desktop first, then run this setup again.\n"));
    process.exit(1);
  }

  const { config, wasAlreadyConfigured } = injectMcpServer(existing || {});
  writeJson(desktopPath, config);

  if (wasAlreadyConfigured) {
    console.log(chalk.yellow("\n  DBConnector was already configured — updated to latest path."));
  } else {
    console.log(chalk.green("\n  ✓ Claude Desktop configured!"));
  }
  console.log(chalk.dim(`  Config: ${desktopPath}`));
  console.log(chalk.bold.yellow("\n  ⟳ Restart Claude Desktop to activate.\n"));
}

// ── Auto-configure Claude Code (project) ────────────────────────────────────
if (selected === "code-project") {
  const existing = readJsonSafe(codePaths.project);
  const { config, wasAlreadyConfigured } = injectMcpServer(existing || {});
  writeJson(codePaths.project, config);

  if (wasAlreadyConfigured) {
    console.log(chalk.yellow("\n  DBConnector was already configured in .mcp.json — updated."));
  } else {
    console.log(chalk.green("\n  ✓ .mcp.json configured!"));
  }
  console.log(chalk.dim(`  Config: ${codePaths.project}\n`));
}

// ── Offer to add a DB connection now ────────────────────────────────────────
const { addNow } = await inquirer.prompt([
  {
    type: "confirm",
    name: "addNow",
    message: "Would you like to add a database connection now?",
    default: true,
  },
]);

if (addNow) {
  console.log(chalk.dim("\n  Launching connection manager...\n"));
  const { execSync } = await import("child_process");
  execSync(`node "${join(__dirname, "cli.js")}" add`, { stdio: "inherit" });
} else {
  console.log(chalk.dim("\n  You can add connections later by telling Claude:"));
  console.log(chalk.white('  "Add my PostgreSQL database at db.example.com, user admin, password secret"'));
  console.log(chalk.dim("\n  Or run the CLI anytime:"));
  console.log(chalk.white("  npm run manage\n"));
}

console.log(chalk.green.bold("  Setup complete! ✓\n"));
