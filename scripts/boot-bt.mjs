import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const nodeCommand = process.execPath;
const prepareOnly = process.argv.includes("--prepare-only");
const passthroughArgs = process.argv.slice(2).filter((arg) => arg !== "--prepare-only");

function resolveRequestedPort() {
  const portFlagIndex = process.argv.findIndex((arg) => arg === "--port" || arg === "-p");
  const inlinePortArg = process.argv.find((arg) => arg.startsWith("--port="));
  const inlinePort = inlinePortArg?.split("=", 2)[1];
  const flagPort = portFlagIndex >= 0 ? process.argv[portFlagIndex + 1] : undefined;

  return inlinePort ?? flagPort ?? process.env.PORT;
}

function validatePort() {
  const port = resolveRequestedPort();

  if (!port) {
    return;
  }

  const portNumber = Number(port);

  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    console.error(`Invalid port: ${port}`);
    console.error("Usage: node scripts/boot-bt.mjs --port 3000");
    process.exit(1);
  }
}

function getMtime(path) {
  if (!existsSync(path)) {
    return 0;
  }

  return statSync(path).mtimeMs;
}

function shouldInstallDependencies() {
  const nextPackage = resolve(projectRoot, "node_modules", "next", "package.json");
  const installedLock = resolve(projectRoot, "node_modules", ".package-lock.json");
  const packageJson = resolve(projectRoot, "package.json");
  const packageLock = resolve(projectRoot, "package-lock.json");
  const installedAt = getMtime(installedLock);

  return (
    !existsSync(nextPackage) ||
    installedAt === 0 ||
    getMtime(packageJson) > installedAt ||
    getMtime(packageLock) > installedAt
  );
}

function collectFiles(root, files = []) {
  if (!existsSync(root)) {
    return files;
  }

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = join(root, entry.name);

    if (entry.isDirectory()) {
      collectFiles(entryPath, files);
      continue;
    }

    if ([".js", ".json"].includes(extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function findBetterSqliteAliases() {
  const aliases = new Set();
  const aliasPattern = /better-sqlite3-[0-9a-f]+/g;

  for (const file of collectFiles(resolve(projectRoot, ".next", "server"))) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(aliasPattern)) {
      aliases.add(match[0]);
    }
  }

  return [...aliases];
}

function ensureBetterSqliteAliases() {
  const aliases = findBetterSqliteAliases();

  if (aliases.length === 0) {
    return;
  }

  if (!existsSync(resolve(projectRoot, "node_modules", "better-sqlite3", "package.json"))) {
    console.error("better-sqlite3 is not installed. Run npm install --omit=dev first.");
    process.exit(1);
  }

  for (const alias of aliases) {
    const aliasRoot = resolve(projectRoot, "node_modules", alias);
    mkdirSync(aliasRoot, { recursive: true });
    writeFileSync(
      resolve(aliasRoot, "package.json"),
      JSON.stringify({ name: alias, version: "0.0.0", main: "index.js" }, null, 2),
    );
    writeFileSync(resolve(aliasRoot, "index.js"), 'module.exports = require("better-sqlite3");\n');
  }

  console.log(`Prepared better-sqlite3 runtime alias: ${aliases.join(", ")}`);
}

function run(command, args) {
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", [command, ...args].join(" ")], {
          cwd: projectRoot,
          shell: false,
          stdio: "inherit",
        })
      : spawnSync(command, args, {
          cwd: projectRoot,
          shell: false,
          stdio: "inherit",
        });

  if (result.error) {
    console.error(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

validatePort();

if (shouldInstallDependencies()) {
  console.log("Installing production dependencies...");
  run(npmCommand, ["install", "--omit=dev", "--no-audit", "--no-fund"]);
} else {
  console.log("Production dependencies are already installed.");
}

ensureBetterSqliteAliases();

console.log("Running database migrations...");
run(npmCommand, ["run", "db:migrate"]);

if (prepareOnly) {
  console.log("BT preparation complete. Start the server with npm run start:bt.");
  process.exit(0);
}

console.log("Starting production server...");
const child = spawn(nodeCommand, ["scripts/start-bt.mjs", ...passthroughArgs], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
