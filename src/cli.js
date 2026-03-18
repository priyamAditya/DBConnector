#!/usr/bin/env node

import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { saveConnection, getConnection, listConnections, removeConnection } from "./db.js";
import { testPgConnection } from "./pg.js";

const banner = `
${chalk.bold.cyan("╔══════════════════════════════════════╗")}
${chalk.bold.cyan("║")}   ${chalk.bold.white("DBConnector")} ${chalk.dim("— MCP PostgreSQL Manager")} ${chalk.bold.cyan("║")}
${chalk.bold.cyan("╚══════════════════════════════════════╝")}
`;

async function promptConnection() {
  console.log(chalk.dim("\nEnter PostgreSQL connection details:\n"));

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Connection name:",
      validate: (v) => (v.trim() ? true : "Name is required"),
    },
    {
      type: "input",
      name: "host",
      message: "Host:",
      default: "localhost",
    },
    {
      type: "number",
      name: "port",
      message: "Port:",
      default: 5432,
    },
    {
      type: "input",
      name: "database",
      message: "Database:",
      validate: (v) => (v.trim() ? true : "Database name is required"),
    },
    {
      type: "input",
      name: "username",
      message: "Username:",
      validate: (v) => (v.trim() ? true : "Username is required"),
    },
    {
      type: "password",
      name: "password",
      message: "Password:",
      mask: "*",
    },
    {
      type: "confirm",
      name: "ssl",
      message: "Use SSL?",
      default: false,
    },
  ]);

  return answers;
}

async function addConnection() {
  const conn = await promptConnection();

  const existing = getConnection(conn.name);
  if (existing) {
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: chalk.yellow(`Connection "${conn.name}" already exists. Overwrite?`),
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.dim("Cancelled."));
      return;
    }
  }

  const spinner = ora("Testing connection...").start();
  try {
    const result = await testPgConnection(conn);
    spinner.succeed(chalk.green("Connected!"));
    console.log(chalk.dim(`  Server: ${result.version}`));

    saveConnection(conn);
    console.log(chalk.green(`\n✓ Connection "${conn.name}" saved.\n`));
  } catch (err) {
    spinner.fail(chalk.red("Connection failed"));
    console.log(chalk.red(`  ${err.message}\n`));
    console.log(chalk.dim("Credentials were NOT saved."));

    const { retry } = await inquirer.prompt([
      { type: "confirm", name: "retry", message: "Try again?", default: true },
    ]);
    if (retry) await addConnection();
  }
}

async function showConnections() {
  const conns = listConnections();
  if (conns.length === 0) {
    console.log(chalk.dim("\n  No connections saved yet.\n"));
    return;
  }
  console.log(chalk.bold("\n  Saved connections:\n"));
  for (const c of conns) {
    console.log(
      `  ${chalk.cyan(c.name.padEnd(15))} ${chalk.dim(`${c.username}@${c.host}:${c.port}/${c.database}`)}${c.ssl ? chalk.yellow(" [SSL]") : ""}`
    );
  }
  console.log();
}

async function deleteConnection() {
  const conns = listConnections();
  if (conns.length === 0) {
    console.log(chalk.dim("\n  No connections to remove.\n"));
    return;
  }

  const { name } = await inquirer.prompt([
    {
      type: "list",
      name: "name",
      message: "Select connection to remove:",
      choices: conns.map((c) => ({
        name: `${c.name} (${c.host}:${c.port}/${c.database})`,
        value: c.name,
      })),
    },
  ]);

  const { confirm } = await inquirer.prompt([
    { type: "confirm", name: "confirm", message: `Remove "${name}"?`, default: false },
  ]);

  if (confirm) {
    removeConnection(name);
    console.log(chalk.green(`\n✓ Connection "${name}" removed.\n`));
  }
}

async function testExistingConnection() {
  const conns = listConnections();
  if (conns.length === 0) {
    console.log(chalk.dim("\n  No connections to test.\n"));
    return;
  }

  const { name } = await inquirer.prompt([
    {
      type: "list",
      name: "name",
      message: "Select connection to test:",
      choices: conns.map((c) => ({
        name: `${c.name} (${c.host}:${c.port}/${c.database})`,
        value: c.name,
      })),
    },
  ]);

  const conn = getConnection(name);
  const spinner = ora(`Testing "${name}"...`).start();
  try {
    const result = await testPgConnection(conn);
    spinner.succeed(chalk.green(`"${name}" is healthy`));
    console.log(chalk.dim(`  Server: ${result.version}\n`));
  } catch (err) {
    spinner.fail(chalk.red(`"${name}" failed: ${err.message}\n`));
  }
}

async function mainMenu() {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: "Add a connection", value: "add" },
        { name: "List connections", value: "list" },
        { name: "Test a connection", value: "test" },
        { name: "Remove a connection", value: "remove" },
        new inquirer.Separator(),
        { name: "Exit", value: "exit" },
      ],
    },
  ]);

  switch (action) {
    case "add":
      await addConnection();
      break;
    case "list":
      await showConnections();
      break;
    case "test":
      await testExistingConnection();
      break;
    case "remove":
      await deleteConnection();
      break;
    case "exit":
      console.log(chalk.dim("Bye!\n"));
      process.exit(0);
  }

  await mainMenu();
}

// ── Entry point ──────────────────────────────────────────────────────────────
const command = process.argv[2];

console.log(banner);

if (command === "add") {
  await addConnection();
  const { more } = await inquirer.prompt([
    { type: "confirm", name: "more", message: "Add another connection?", default: false },
  ]);
  if (more) await addConnection();
} else {
  const conns = listConnections();
  if (conns.length === 0) {
    console.log(chalk.yellow("No connections configured yet. Let's add your first one!\n"));
    await addConnection();

    const { more } = await inquirer.prompt([
      { type: "confirm", name: "more", message: "Add another connection?", default: false },
    ]);
    if (more) await addConnection();
  }
  await mainMenu();
}
