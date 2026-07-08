import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";
import { normalizeForwardedHostHeaders } from "./forwarded-host.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildIdPath = resolve(projectRoot, ".next", "BUILD_ID");
const hostname = "0.0.0.0";

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
const portNumber = Number(port);

process.env.NODE_ENV = "production";
process.env.NEXT_TELEMETRY_DISABLED ??= "1";
process.env.SECURE_COOKIES ??= "false";
process.env.PORT = port;
process.env.INTERNAL_REMINDER_TOKEN ??= randomBytes(32).toString("hex");

if (!existsSync(buildIdPath)) {
  console.error("");
  console.error("Missing Next.js production build artifact: .next/BUILD_ID");
  console.error("");
  console.error("Deploy a release package, or build one first:");
  console.error("  npm run release");
  console.error("");
  console.error("After extracting the release package on the server, run:");
  console.error("  npm install --omit=dev");
  console.error("  npm run db:migrate");
  console.error("  npm run start:bt");
  console.error("");
  console.error("Keep the BT start command as only: npm run start:bt");
  console.error("Do not put npm run build in the BT start command.");
  console.error("");
  process.exit(1);
}

const app = next({
  dev: false,
  dir: projectRoot,
  hostname,
  port: portNumber,
});
const handle = app.getRequestHandler();
let upgradeHandler;
let reminderInterval;
let reminderInitialTimer;
let reminderInFlight = false;

function readReminderIntervalMs() {
  const parsed = Number(process.env.REMINDER_CHECK_INTERVAL_MS ?? "60000");
  return Number.isInteger(parsed) && parsed >= 10_000 ? parsed : 60_000;
}

async function runReminderTick(reason) {
  if (reminderInFlight) {
    return;
  }

  reminderInFlight = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/reminders/run`, {
      method: "POST",
      headers: {
        "x-internal-reminder-token": process.env.INTERNAL_REMINDER_TOKEN,
      },
      signal: controller.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      console.error(`Reminder check failed during ${reason}: ${response.status} ${text}`);
      return;
    }

    try {
      const body = JSON.parse(text);
      if (body?.data?.failed > 0) {
        console.warn(`Reminder check completed with failures during ${reason}: ${text}`);
      }
    } catch {
      // Non-JSON response still means the request completed successfully.
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Reminder check failed during ${reason}: ${message}`);
  } finally {
    clearTimeout(timeout);
    reminderInFlight = false;
  }
}

function startReminderScheduler() {
  if (process.env.REMINDER_CHECK_DISABLED === "1") {
    console.log("Reminder scheduler disabled by REMINDER_CHECK_DISABLED=1");
    return;
  }

  const intervalMs = readReminderIntervalMs();
  reminderInitialTimer = setTimeout(() => {
    void runReminderTick("startup");
  }, 5_000);
  reminderInterval = setInterval(() => {
    void runReminderTick("interval");
  }, intervalMs);
  reminderInitialTimer.unref?.();
  reminderInterval.unref?.();
  console.log(`Reminder scheduler enabled every ${intervalMs}ms`);
}

const server = createServer(async (req, res) => {
  normalizeForwardedHostHeaders(req.headers);

  try {
    await handle(req, res);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

server.on("upgrade", (req, socket, head) => {
  normalizeForwardedHostHeaders(req.headers);
  void upgradeHandler?.(req, socket, head);
});

server.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

await app.prepare();
upgradeHandler = app.getUpgradeHandler();

server.listen(portNumber, hostname, () => {
  console.log(`SlimmingAssistant started on http://${hostname}:${port}`);
  startReminderScheduler();
});

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  clearTimeout(reminderInitialTimer);
  clearInterval(reminderInterval);
  server.close(async () => {
    await app.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
