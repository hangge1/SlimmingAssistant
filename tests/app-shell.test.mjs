import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createAccessRepository } from "../features/access/repositories/access-repository.ts";
import { createDeviceToken, hashDeviceToken } from "../features/access/services/device-token.ts";
import * as schema from "../db/schema.ts";

const navigationSource = readFileSync("lib/navigation.ts", "utf8");
const layoutSource = readFileSync("app/layout.tsx", "utf8");
const pageSource = readFileSync("app/page.tsx", "utf8");
const desktopNavSource = readFileSync("components/layout/desktop-sidebar.tsx", "utf8");
const mobileNavSource = readFileSync("components/layout/mobile-nav.tsx", "utf8");
const buttonSource = readFileSync("components/ui/button.tsx", "utf8");
const globalsSource = readFileSync("app/globals.css", "utf8");
const uiScreenshotSource = readFileSync("scripts/ui-screenshot.mjs", "utf8");
const packageSource = JSON.parse(readFileSync("package.json", "utf8"));
const saveHealthRecordActionSource = readFileSync("features/records/actions/save-health-record.ts", "utf8");
const saveRunRecordActionSource = readFileSync("features/records/actions/save-run-record.ts", "utf8");
const updateHealthRecordActionSource = readFileSync("features/records/actions/update-health-record.ts", "utf8");
const updateRunRecordActionSource = readFileSync("features/records/actions/update-run-record.ts", "utf8");
const deleteRecordActionSource = readFileSync("features/records/actions/delete-record.ts", "utf8");
const recordsPageSource = readFileSync("app/records/page.tsx", "utf8");
const historyPageSource = readFileSync("app/history/page.tsx", "utf8");
const goalsPageSource = readFileSync("app/goals/page.tsx", "utf8");
const settingsPageSource = readFileSync("app/settings/page.tsx", "utf8");
const trendLineChartSource = readFileSync("features/dashboard/components/trend-line-chart.tsx", "utf8");
const runRecordFormSource = readFileSync("features/records/components/run-record-form.tsx", "utf8");
const runRecordEditFormSource = readFileSync("features/records/components/run-record-edit-form.tsx", "utf8");
const saveProfileActionSource = readFileSync("features/settings/actions/save-profile.ts", "utf8");
const saveTrendThresholdActionSource = readFileSync("features/settings/actions/save-trend-threshold.ts", "utf8");
const saveReminderRuleActionSource = readFileSync("features/settings/actions/save-reminder-rule.ts", "utf8");
const saveSmtpConfigActionSource = readFileSync("features/settings/actions/save-smtp-config.ts", "utf8");
const sendTestEmailActionSource = readFileSync("features/settings/actions/send-test-email.ts", "utf8");
const changeAccessPasswordActionSource = readFileSync("features/access/actions/change-access-password.ts", "utf8");
const revokeTrustedDeviceActionSource = readFileSync("features/access/actions/revoke-trusted-device.ts", "utf8");
const saveHealthGoalActionSource = readFileSync("features/goals/actions/save-health-goal.ts", "utf8");
const saveRunGoalActionSource = readFileSync("features/goals/actions/save-run-goal.ts", "utf8");

async function getFreePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

async function waitForReady(baseUrl, child, output) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      const serverOutput = output.join("");
      throw new Error(`Next dev server exited early.\n${serverOutput}`);
    }

    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return baseUrl;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Next dev server did not become ready.\n${output.join("")}`);
}

function createInitializedAccessDatabase() {
  const dir = mkdtempSync(join(tmpdir(), "slimming-assistant-routes-"));
  const sqlitePath = join(dir, "routes.sqlite");
  const sqlite = new Database(sqlitePath);
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./db/migrations" });
  const repository = createAccessRepository(db);
  const deviceToken = createDeviceToken();
  repository.saveAccessSecret({
    passwordHash: "scrypt:v1:test",
    passwordHashAlgorithm: "scrypt:v1",
    nowIso: "2026-06-26T00:00:00.000Z",
  });
  repository.createTrustedDevice({
    deviceIdentifierHash: hashDeviceToken(deviceToken),
    displayName: "测试浏览器",
    userAgent: "node-test",
    nowIso: "2026-06-26T00:00:00.000Z",
  });
  sqlite.close();

  return {
    deviceToken,
    sqlitePath,
    cleanup() {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}

test("主导航使用中文页面，并包含固定的五个入口", () => {
  for (const label of ["首页", "记录", "历史", "目标", "设置"]) {
    assert.match(navigationSource, new RegExp(`label: "${label}"`));
  }
});

test("根布局允许浏览器扩展注入 html 属性，避免误报水合错误", () => {
  assert.match(layoutSource, /<html lang="zh-CN" suppressHydrationWarning>/);
});

test("首页是应用仪表盘，不是营销页面", () => {
  assert.match(pageSource, /瘦身助手/);
  assert.match(pageSource, /记录今天/);
  assert.match(pageSource, /今日状态/);
  assert.match(pageSource, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.match(pageSource, /todayStatusLabel/);
  assert.match(pageSource, /createDashboardSummary/);
  assert.match(pageSource, /TrendLineChart/);
  assert.match(pageSource, /GoalProgressChart/);
  assert.match(pageSource, /strokeDasharray/);
  assert.match(pageSource, /数据曲线/);
  assert.ok(pageSource.indexOf('id="goal-progress"') < pageSource.indexOf('aria-label="首页摘要"'));
  assert.ok(pageSource.indexOf('id="goal-progress"') < pageSource.indexOf('id="data-curves"'));
  assert.match(pageSource, /href="\/records"|href: "\/records"/);
  assert.match(pageSource, /requireTrustedDevice/);
  assert.doesNotMatch(pageSource, /\.insert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(pageSource, /landing|hero|pricing|signup/i);
});

test("首页曲线图使用 SVG 展示健康和运动趋势", () => {
  assert.match(trendLineChartSource, /use client/);
  assert.match(trendLineChartSource, /<select/);
  assert.match(trendLineChartSource, /selectedPeriodLabel/);
  assert.match(trendLineChartSource, /startLocalDate/);
  assert.match(trendLineChartSource, /endLocalDate/);
  assert.match(trendLineChartSource, /<svg/);
  assert.match(trendLineChartSource, /<path/);
  assert.match(trendLineChartSource, /axisLabels/);
  assert.match(trendLineChartSource, /onMouseEnter/);
  assert.match(trendLineChartSource, /曲线/);
  assert.match(trendLineChartSource, /暂无可绘制数据/);
});

test("跑步配速是只读计算项，不作为用户输入字段", () => {
  for (const source of [runRecordFormSource, runRecordEditFormSource]) {
    assert.match(source, /calculatePaceText/);
    assert.match(source, /只读/);
    assert.doesNotMatch(source, /name: "paceMinutesPerKm"/);
  }
});

test("导航、按钮和移动端安全区具备基础交互保护", () => {
  assert.match(desktopNavSource, /usePathname/);
  assert.match(mobileNavSource, /usePathname/);
  assert.match(desktopNavSource, /aria-current/);
  assert.match(mobileNavSource, /aria-current/);
  assert.match(buttonSource, /type: type \?\? "button"/);
  assert.match(mobileNavSource, /safe-area-inset-bottom/);
  assert.match(globalsSource, /safe-area-inset-bottom/);
});

test("桌面端主内容使用可用宽度，不固定在窄容器中", () => {
  assert.match(globalsSource, /\.page-main\s*{\s*width: 100%;\s*padding: 24px;\s*}/);
  assert.doesNotMatch(globalsSource, /\.page-main\s*{[^}]*max-width:\s*1200px/s);
});

test("基础质量命令存在", () => {
  assert.equal(packageSource.scripts.typecheck, "next typegen && tsc --noEmit");
  assert.ok(packageSource.scripts.lint);
  assert.ok(packageSource.scripts.build);
  assert.ok(packageSource.scripts.dev);
  assert.equal(packageSource.scripts["ui:screenshot"], "node scripts/ui-screenshot.mjs");
  assert.ok(packageSource.scripts["db:generate"]);
  assert.ok(packageSource.scripts["db:migrate"]);
});

test("UI 截图脚本使用隔离数据库和 Playwright 生成桌面与移动端截图", () => {
  assert.match(uiScreenshotSource, /from "playwright"/);
  assert.match(uiScreenshotSource, /mkdtempSync/);
  assert.match(uiScreenshotSource, /SQLITE_PATH: seededDb\.sqlitePath/);
  assert.match(uiScreenshotSource, /desktop/);
  assert.match(uiScreenshotSource, /mobile/);
  assert.match(uiScreenshotSource, /page\.screenshot/);
});

test("健康记录保存入口受保护并复用 records service", () => {
  assert.match(saveHealthRecordActionSource, /requireTrustedDevice/);
  assert.match(saveHealthRecordActionSource, /saveHealthRecord/);
  assert.doesNotMatch(saveHealthRecordActionSource, /\.insert\(|\.update\(|\.delete\(/);
});

test("跑步记录保存入口受保护并复用 records service", () => {
  assert.match(saveRunRecordActionSource, /requireTrustedDevice/);
  assert.match(saveRunRecordActionSource, /createRunRecord/);
  assert.doesNotMatch(saveRunRecordActionSource, /\.insert\(|\.update\(|\.delete\(/);
});

test("历史编辑和删除入口受保护并复用 records service", () => {
  for (const source of [updateHealthRecordActionSource, updateRunRecordActionSource, deleteRecordActionSource]) {
    assert.match(source, /requireTrustedDevice/);
    assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(/);
  }

  assert.match(historyPageSource, /确认删除这条记录/);
  assert.match(historyPageSource, /\/history\/\$\{entry.kind\}\/\$\{entry.id\}\/edit/);
  assert.match(historyPageSource, /sm:justify-end/);
  assert.doesNotMatch(historyPageSource, /border-t border-\[var\(--border-soft\)\] pt-3/);
});

test("历史页提供按日期补录入口，记录保存使用提交日期", () => {
  assert.match(historyPageSource, /补充历史记录/);
  assert.match(historyPageSource, /action="\/records"/);
  assert.match(historyPageSource, /name="date"/);
  assert.match(historyPageSource, /去补录/);

  assert.match(recordsPageSource, /searchParams/);
  assert.match(recordsPageSource, /validateLocalDate/);
  assert.match(recordsPageSource, /提交记录/);
  assert.match(recordsPageSource, /记录日期/);
  assert.match(recordsPageSource, /localDate=\{localDate\}/);

  for (const source of [saveHealthRecordActionSource, saveRunRecordActionSource]) {
    assert.match(source, /formData\.get\("localDate"\)/);
    assert.match(source, /localDate,/);
    assert.match(source, /revalidatePath\("\/history"\)/);
  }
});

test("健康目标保存入口受保护并复用 goals service", () => {
  assert.match(saveHealthGoalActionSource, /requireTrustedDevice/);
  assert.match(saveHealthGoalActionSource, /saveHealthGoal/);
  assert.doesNotMatch(saveHealthGoalActionSource, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(goalsPageSource, /getHealthGoal/);
  assert.match(goalsPageSource, /requireTrustedDevice/);
});

test("跑步目标保存入口受保护并复用 goals service", () => {
  assert.match(saveRunGoalActionSource, /requireTrustedDevice/);
  assert.match(saveRunGoalActionSource, /saveRunGoal/);
  assert.doesNotMatch(saveRunGoalActionSource, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(goalsPageSource, /getRunGoal/);
});

test("设置页受保护并且不直接写数据库", () => {
  assert.match(settingsPageSource, /requireTrustedDevice/);
  assert.doesNotMatch(settingsPageSource, /\.insert\(|\.update\(|\.delete\(/);
});

test("个人资料保存入口受保护并复用 settings service", () => {
  assert.match(saveProfileActionSource, /requireTrustedDevice/);
  assert.match(saveProfileActionSource, /saveProfileSettings/);
  assert.doesNotMatch(saveProfileActionSource, /\.insert\(|\.update\(|\.delete\(/);
});

test("趋势阈值保存入口受保护并复用 settings service", () => {
  assert.match(saveTrendThresholdActionSource, /requireTrustedDevice/);
  assert.match(saveTrendThresholdActionSource, /saveTrendThresholdSettings/);
  assert.doesNotMatch(saveTrendThresholdActionSource, /\.insert\(|\.update\(|\.delete\(/);
});

test("提醒规则保存入口受保护并复用 settings service", () => {
  assert.match(saveReminderRuleActionSource, /requireTrustedDevice/);
  assert.match(saveReminderRuleActionSource, /saveReminderRuleSettings/);
  assert.doesNotMatch(saveReminderRuleActionSource, /\.insert\(|\.update\(|\.delete\(/);
});

test("SMTP 配置和测试邮件入口受保护并复用 settings service", () => {
  for (const source of [saveSmtpConfigActionSource, sendTestEmailActionSource]) {
    assert.match(source, /requireTrustedDevice/);
    assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(/);
  }

  assert.match(saveSmtpConfigActionSource, /saveSmtpConfig/);
  assert.match(sendTestEmailActionSource, /sendTestEmail/);
});

test("访问保护设置入口受保护并复用 access service", () => {
  for (const source of [changeAccessPasswordActionSource, revokeTrustedDeviceActionSource]) {
    assert.match(source, /requireTrustedDevice/);
    assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(/);
  }

  assert.match(changeAccessPasswordActionSource, /changeAccessPassword/);
  assert.match(revokeTrustedDeviceActionSource, /revokeTrustedDevice/);
});

test("主要路由可以通过 Next 实际渲染", { timeout: 90_000 }, async () => {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const accessDb = createInitializedAccessDatabase();
  const output = [];
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "-p", String(port), "-H", "127.0.0.1"],
    {
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", SQLITE_PATH: accessDb.sqlitePath },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));

  try {
    const actualBaseUrl = await waitForReady(baseUrl, child, output);
    for (const protectedPath of ["/", "/records", "/history", "/goals", "/settings"]) {
      const unauthenticated = await fetch(`${actualBaseUrl}${protectedPath}`, { redirect: "manual" });
      assert.ok(
        unauthenticated.status >= 300 && unauthenticated.status < 400,
        `expected redirect for ${protectedPath}, received ${unauthenticated.status}`,
      );
      assert.match(unauthenticated.headers.get("location") ?? "", /\/access\/verify$/);
    }

    for (const [path, expectedText] of [
      ["/", "记录今天"],
      ["/records", "健康记录"],
      ["/history", "历史"],
      ["/goals", "目标"],
      ["/settings", "设置"],
    ]) {
      const response = await fetch(`${actualBaseUrl}${path}`, {
        headers: { cookie: `slimming_device_token=${accessDb.deviceToken}` },
      });
      const html = await response.text();

      assert.equal(response.status, 200, `${path} should render`);
      assert.match(html, /瘦身助手/);
      assert.match(html, new RegExp(expectedText));

      if (path === "/records") {
        assert.match(html, /体重/);
        assert.match(html, /腰围/);
        assert.match(html, /臀围/);
        assert.match(html, /体脂率/);
        assert.match(html, /公里数/);
        assert.match(html, /运动时长/);
        assert.match(html, /配速/);
        assert.match(html, /平均心率/);
      }

      if (path === "/") {
        assert.match(html, /今日状态/);
        assert.match(html, /今日反馈/);
        assert.match(html, /身体数据/);
        assert.match(html, /跑步记录/);
        assert.match(html, /提醒状态/);
        assert.match(html, /目标设置/);
        assert.match(html, /健康摘要/);
        assert.match(html, /运动摘要/);
        assert.match(html, /目标摘要/);
        assert.match(html, /目标进度/);
        assert.match(html, /健康目标进度/);
        assert.match(html, /跑步目标进度/);
        assert.match(html, /完成度/);
        assert.match(html, /无法可靠估算/);
        assert.match(html, /数据曲线/);
        assert.match(html, /健康曲线/);
        assert.match(html, /运动曲线/);
        assert.match(html, /每日跑量/);
        assert.match(html, /最近 7 天/);
        assert.match(html, /最近 1 个月/);
        assert.match(html, /最近半年/);
        assert.match(html, /最近 1 年/);
        assert.match(html, /最近 30 天/);
        assert.match(html, /BMI/);
        assert.doesNotMatch(html, /趋势和 BMI/);
      }

      if (path === "/history") {
        assert.match(html, /历史记录/);
        assert.match(html, /类型/);
        assert.match(html, /最近 7 天/);
        assert.match(html, /没有历史记录/);
      }

      if (path === "/goals") {
        assert.match(html, /健康目标/);
        assert.match(html, /目标体重/);
        assert.match(html, /目标腰围/);
        assert.match(html, /目标臀围/);
        assert.match(html, /目标体脂率/);
        assert.match(html, /跑步目标/);
        assert.match(html, /每周跑步次数/);
        assert.match(html, /每周跑量/);
        assert.match(html, /公斤/);
        assert.match(html, /厘米/);
        assert.match(html, /次/);
      }

      if (path === "/settings") {
        assert.match(html, /配置中心/);
        assert.match(html, /个人资料/);
        assert.match(html, /昵称/);
        assert.match(html, /身高/);
        assert.match(html, /厘米/);
        assert.match(html, /提醒收件邮箱/);
        assert.match(html, /提醒规则/);
        assert.match(html, /每日提醒时间/);
        assert.match(html, /站内提醒/);
        assert.match(html, /邮件提醒/);
        assert.match(html, /SMTP 邮件/);
        assert.match(html, /SMTP 主机/);
        assert.match(html, /安全模式/);
        assert.match(html, /测试邮件/);
        assert.match(html, /清空 SMTP 配置/);
        assert.match(html, /最近邮件提醒状态/);
        assert.match(html, /趋势估算/);
        assert.match(html, /最低统计天数/);
        assert.match(html, /最低有效记录数/);
        assert.match(html, /访问保护/);
        assert.match(html, /当前访问密码/);
        assert.match(html, /新访问密码/);
        assert.match(html, /受信设备/);
        assert.match(html, /移除/);
      }
    }
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([
        once(child, "exit"),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
    }
    accessDb.cleanup();
  }
});
