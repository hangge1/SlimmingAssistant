import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = require.resolve("next/dist/bin/next");
const buildIdPath = resolve(projectRoot, ".next", "BUILD_ID");

function resolvePort() {
  const portFlagIndex = process.argv.findIndex((arg) => arg === "--port" || arg === "-p");
  const inlinePortArg = process.argv.find((arg) => arg.startsWith("--port="));
  const inlinePort = inlinePortArg?.split("=", 2)[1];
  const flagPort = portFlagIndex >= 0 ? process.argv[portFlagIndex + 1] : undefined;
  const port = inlinePort ?? flagPort ?? process.env.PORT ?? "3000";
  const portNumber = Number(port);

  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    console.error(`Invalid port: ${port}`);
    console.error("Usage: node scripts/start-bt.mjs --port 3000");
    process.exit(1);
  }

  return String(portNumber);
}

const port = resolvePort();

process.env.NODE_ENV = "production";
process.env.NEXT_TELEMETRY_DISABLED ??= "1";
process.env.SECURE_COOKIES ??= "false";

if (!existsSync(buildIdPath)) {
  console.error("");
  console.error("未找到 Next.js 生产构建产物：.next/BUILD_ID");
  console.error("");
  console.error("请使用发布包部署，或先在构建机执行：");
  console.error("  npm run release");
  console.error("");
  console.error("服务器解压发布包后执行：");
  console.error("  npm install --omit=dev");
  console.error("  npm run db:migrate");
  console.error("  npm run start:bt");
  console.error("");
  console.error("宝塔启动命令只保留：npm run start:bt");
  console.error("不要把 npm run build 放在启动命令里，否则重启时会打满 CPU/内存。");
  console.error("");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [nextBin, "start", "-H", "0.0.0.0", "-p", port],
  {
    env: process.env,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
