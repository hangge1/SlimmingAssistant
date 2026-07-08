import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { chromium } from "playwright";

import * as schema from "../db/schema.ts";
import { createAccessRepository } from "../features/access/repositories/access-repository.ts";
import { DEVICE_TOKEN_COOKIE, createDeviceToken, hashDeviceToken } from "../features/access/services/device-token.ts";

const outputRoot = resolve(".ui-screenshots");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = join(outputRoot, runId);
const pages = [
  { path: "/", name: "首页" },
  { path: "/records", name: "记录" },
  { path: "/history", name: "历史" },
  { path: "/goals", name: "目标" },
  { path: "/settings", name: "设置" },
];
const viewports = [
  { name: "wide", width: 1920, height: 1080 },
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

function formatLocalDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(localDate, days) {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return formatLocalDate(date);
}

async function getFreePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

function createSeededDatabase() {
  const dir = mkdtempSync(join(tmpdir(), "slimming-assistant-ui-"));
  const sqlitePath = join(dir, "ui.sqlite");
  const sqlite = new Database(sqlitePath);
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./db/migrations" });

  const nowIso = "2026-06-26T08:00:00.000Z";
  const today = "2026-06-26";
  const deviceToken = createDeviceToken();
  const accessRepository = createAccessRepository(db);

  accessRepository.saveAccessSecret({
    passwordHash: "scrypt:v1:ui-screenshot",
    passwordHashAlgorithm: "scrypt:v1",
    nowIso,
  });
  accessRepository.createTrustedDevice({
    deviceIdentifierHash: hashDeviceToken(deviceToken),
    displayName: "UI 截图浏览器",
    userAgent: "playwright-ui-screenshot",
    nowIso,
  });

  const healthRows = Array.from({ length: 14 }, (_, index) => {
    const localDate = addDays(today, index - 13);
    return {
      id: `health-${index}`,
      localDate,
      weightKg: Math.round((82 - index * 0.32 + Math.sin(index) * 0.18) * 10) / 10,
      waistCm: Math.round((92 - index * 0.22) * 10) / 10,
      hipCm: Math.round((101 - index * 0.08) * 10) / 10,
      bodyFatPercentage: Math.round((25 - index * 0.18) * 10) / 10,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
  });
  db.insert(schema.healthRecords).values(healthRows).run();

  const runRows = [0, 2, 4, 7, 9, 11, 13].map((dayOffset, index) => ({
    id: `run-${index}`,
    localDate: addDays(today, dayOffset - 13),
    distanceKm: [4.2, 5.0, 3.6, 6.4, 4.8, 5.5, 7.2][index],
    durationSeconds: [1560, 1860, 1390, 2440, 1780, 2080, 2700][index],
    paceSecondsPerKm: [371, 372, 386, 381, 371, 378, 375][index],
    averageHeartRateBpm: [138, 141, 136, 146, 140, 142, 148][index],
    averageStrideMeters: 1.05,
    cadenceSpm: 166,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  }));
  db.insert(schema.runRecords).values(runRows).run();

  db.insert(schema.goals)
    .values([
      {
        id: "goal-health",
        type: "health",
        targetWeightKg: 76,
        targetWaistCm: 86,
        targetHipCm: null,
        targetBodyFatPercentage: 20,
        weeklyRunCount: null,
        weeklyDistanceKm: null,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
      {
        id: "goal-run",
        type: "run",
        targetWeightKg: null,
        targetWaistCm: null,
        targetHipCm: null,
        targetBodyFatPercentage: null,
        weeklyRunCount: 4,
        weeklyDistanceKm: 20,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
    ])
    .run();

  db.insert(schema.settings)
    .values([
      {
        id: "profile-default",
        type: "profile",
        key: "profile",
        valueJson: JSON.stringify({ displayName: "hangge", heightCm: 175, reminderEmail: "user@example.com" }),
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
      {
        id: "reminder-default",
        type: "reminder",
        key: "daily",
        valueJson: JSON.stringify({ enabled: true, inAppEnabled: true, emailEnabled: false, reminderTime: "21:30" }),
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      },
    ])
    .run();

  sqlite.close();

  return {
    deviceToken,
    sqlitePath,
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function waitForServer(baseUrl, child, output) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next dev server exited early.\n${output.join("")}`);
    }

    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status > 0) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Next dev server did not become ready.\n${output.join("")}`);
}

function findBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    process.env.CHROME_EXECUTABLE,
  ];

  if (process.platform === "win32") {
    candidates.push(
      join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
      join(process.env.PROGRAMFILES ?? "", "Google/Chrome/Application/chrome.exe"),
      join(process.env["PROGRAMFILES(X86)"] ?? "", "Google/Chrome/Application/chrome.exe"),
      join(process.env.LOCALAPPDATA ?? "", "Microsoft/Edge/Application/msedge.exe"),
      join(process.env.PROGRAMFILES ?? "", "Microsoft/Edge/Application/msedge.exe"),
      join(process.env["PROGRAMFILES(X86)"] ?? "", "Microsoft/Edge/Application/msedge.exe"),
    );
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/microsoft-edge",
    );
  }

  return candidates.find((candidate) => candidate && existsSync(candidate));
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (error) {
    if (!/Executable doesn't exist|browserType\.launch/i.test(error.message)) {
      throw error;
    }

    const executablePath = findBrowserExecutable();
    if (!executablePath) {
      throw error;
    }

    console.warn(`Playwright 浏览器未安装，改用系统浏览器：${executablePath}`);
    return chromium.launch({ executablePath });
  }
}

async function main() {
  mkdirSync(outputDir, { recursive: true });

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const seededDb = createSeededDatabase();
  const output = [];
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port), "-H", "127.0.0.1"], {
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      SQLITE_PATH: seededDb.sqlitePath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));

  let browser;

  try {
    await waitForServer(baseUrl, child, output);
    browser = await launchBrowser();

    for (const viewport of viewports) {
      const context = await browser.newContext({
        locale: "zh-CN",
        viewport: { width: viewport.width, height: viewport.height },
      });
      await context.addInitScript(() => {
        window.localStorage.setItem("slimming-assistant-onboarding-seen-v2", "1");
      });
      await context.addCookies([
        {
          name: DEVICE_TOKEN_COOKIE,
          value: seededDb.deviceToken,
          domain: "127.0.0.1",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);

      const page = await context.newPage();
      for (const target of pages) {
        await page.goto(`${baseUrl}${target.path}`, { waitUntil: "networkidle" });
        await page.screenshot({
          fullPage: true,
          path: join(outputDir, `${viewport.name}-${target.name}.png`),
        });
      }

      await context.close();
    }

    console.log(`UI 截图已生成：${outputDir}`);
  } finally {
    if (browser) {
      await browser.close();
    }

    if (child.exitCode === null) {
      child.kill();
      await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))]);
    }

    seededDb.cleanup();
  }
}

main().catch((error) => {
  console.error(error.message);
  if (/Executable doesn't exist|browserType.launch/i.test(error.message)) {
    console.error("请先运行：npx playwright install chromium");
  }
  process.exitCode = 1;
});
