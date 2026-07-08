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
const topNavSource = readFileSync("components/layout/top-nav.tsx", "utf8");
const logoutRouteSource = readFileSync("app/access/logout/route.ts", "utf8");
const verifySubmitRouteSource = readFileSync("app/access/verify/submit/route.ts", "utf8");
const verifyAccessPageSource = readFileSync("app/access/verify/page.tsx", "utf8");
const createAccessPageSource = readFileSync("app/access/create/page.tsx", "utf8");
const loginWelcomeToastSource = readFileSync("components/layout/login-welcome-toast.tsx", "utf8");
const verifyAccessPasswordFormSource = readFileSync("features/access/components/verify-access-password-form.tsx", "utf8");
const pageTurnControlsSource = readFileSync("components/layout/page-turn-controls.tsx", "utf8");
const buttonSource = readFileSync("components/ui/button.tsx", "utf8");
const globalsSource = readFileSync("app/globals.css", "utf8");
const uiScreenshotSource = readFileSync("scripts/ui-screenshot.mjs", "utf8");
const deployCloudSource = readFileSync("scripts/deploy-cloud.mjs", "utf8");
const ensureBtNodeProjectSource = readFileSync("scripts/ensure-bt-node-project.mjs", "utf8");
const startBtSource = readFileSync("scripts/start-bt.mjs", "utf8");
const reminderRunRouteSource = readFileSync("app/api/reminders/run/route.ts", "utf8");
const reminderSchedulerSource = readFileSync("features/reminders/services/reminder-scheduler.ts", "utf8");
const packageSource = JSON.parse(readFileSync("package.json", "utf8"));
const saveHealthRecordActionSource = readFileSync("features/records/actions/save-health-record.ts", "utf8");
const saveRunRecordActionSource = readFileSync("features/records/actions/save-run-record.ts", "utf8");
const updateHealthRecordActionSource = readFileSync("features/records/actions/update-health-record.ts", "utf8");
const updateRunRecordActionSource = readFileSync("features/records/actions/update-run-record.ts", "utf8");
const deleteRecordActionSource = readFileSync("features/records/actions/delete-record.ts", "utf8");
const recordsPageSource = readFileSync("app/records/page.tsx", "utf8");
const historyPageSource = readFileSync("app/history/page.tsx", "utf8");
const goalsPageSource = readFileSync("app/goals/page.tsx", "utf8");
const goalSettingsSectionSource = readFileSync("features/goals/components/goal-settings-section.tsx", "utf8");
const settingsPageSource = readFileSync("app/settings/page.tsx", "utf8");
const trendLineChartSource = readFileSync("features/dashboard/components/trend-line-chart.tsx", "utf8");
const runRecordFormSource = readFileSync("features/records/components/run-record-form.tsx", "utf8");
const runRecordEditFormSource = readFileSync("features/records/components/run-record-edit-form.tsx", "utf8");
const saveProfileActionSource = readFileSync("features/settings/actions/save-profile.ts", "utf8");
const recipientEmailFormStateSource = readFileSync("features/settings/actions/recipient-email-form-state.ts", "utf8");
const saveRecipientEmailActionSource = readFileSync("features/settings/actions/save-recipient-email.ts", "utf8");
const sendRecipientTestEmailActionSource = readFileSync("features/settings/actions/send-recipient-test-email.ts", "utf8");
const recipientEmailFormSource = readFileSync("features/settings/components/recipient-email-form.tsx", "utf8");
const saveTrendThresholdActionSource = readFileSync("features/settings/actions/save-trend-threshold.ts", "utf8");
const saveReminderRuleActionSource = readFileSync("features/settings/actions/save-reminder-rule.ts", "utf8");
const saveSmtpConfigActionSource = readFileSync("features/settings/actions/save-smtp-config.ts", "utf8");
const sendTestEmailActionSource = readFileSync("features/settings/actions/send-test-email.ts", "utf8");
const changeAccessPasswordActionSource = readFileSync("features/access/actions/change-access-password.ts", "utf8");
const revokeTrustedDeviceActionSource = readFileSync("features/access/actions/revoke-trusted-device.ts", "utf8");
const createManagedUserActionSource = readFileSync("features/access/actions/create-managed-user.ts", "utf8");
const manageUsersActionSource = readFileSync("features/access/actions/manage-users.ts", "utf8");
const userManagementPanelSource = readFileSync("features/access/components/user-management-panel.tsx", "utf8");
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
    async cleanup() {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
          return;
        } catch (error) {
          if (!["EBUSY", "ENOTEMPTY", "EPERM"].includes(error.code) || attempt === 9) {
            throw error;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    },
  };
}

test("主导航使用中文页面，并包含固定的五个入口", () => {
  for (const label of ["首页", "打卡", "数据", "历史", "设置"]) {
    assert.match(navigationSource, new RegExp(`label: "${label}"`));
  }
});

test("根布局允许浏览器扩展注入 html 属性，避免误报水合错误", () => {
  assert.match(layoutSource, /<html lang="zh-CN" suppressHydrationWarning>/);
});

test("首页是应用仪表盘，不是营销页面", () => {
  assert.match(pageSource, /跑步瘦身首页入口/);
  assert.match(pageSource, /目标体重/);
  assert.match(pageSource, /目标腰围/);
  assert.match(pageSource, /今日打卡/);
  assert.match(pageSource, /本周跑量/);
  assert.match(pageSource, /累计跑量/);
  assert.match(pageSource, /OnboardingGuide/);
  assert.match(pageSource, /createDashboardSummary/);
  assert.match(pageSource, /href="\/records"|href: "\/records"/);
  assert.match(pageSource, /"\/data"/);
  assert.match(pageSource, /href="\/history"|href: "\/history"/);
  assert.match(pageSource, /requireAuthContext/);
  assert.match(pageSource, /createRecordsRepositoryForAuth/);
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
  assert.match(topNavSource, /usePathname/);
  assert.match(topNavSource, /LogOut/);
  assert.match(topNavSource, /action="\/access\/logout"/);
  assert.match(topNavSource, /authMode === "guest"/);
  assert.match(topNavSource, /item\.href !== "\/settings"/);
  assert.match(logoutRouteSource, /USER_SESSION_COOKIE/);
  assert.match(logoutRouteSource, /GUEST_SESSION_COOKIE/);
  assert.match(logoutRouteSource, /DEVICE_TOKEN_COOKIE/);
  assert.match(logoutRouteSource, /revokeSessionByHash/);
  assert.match(logoutRouteSource, /deleteGuestSession/);
  assert.match(verifyAccessPasswordFormSource, /name="username"[\s\S]*?required/);
  assert.match(verifyAccessPasswordFormSource, /placeholder="请输入用户名"/);
  assert.match(verifyAccessPasswordFormSource, /name="password"[\s\S]*?required/);
  assert.match(verifyAccessPasswordFormSource, /placeholder="请输入密码"/);
  assert.match(pageTurnControlsSource, /usePathname/);
  assert.match(topNavSource, /aria-current/);
  assert.match(topNavSource, /top-nav-scroll/);
  assert.match(pageTurnControlsSource, /page-turn-zone/);
  assert.match(buttonSource, /type: type \?\? "button"/);
  assert.match(globalsSource, /page-turn-zone:hover/);
  assert.match(globalsSource, /top-nav-scroll/);
});

test("access pages use a motion background and prominent title treatment", () => {
  for (const source of [verifyAccessPageSource, createAccessPageSource]) {
    assert.match(source, /auth-page/);
    assert.match(source, /auth-motion-scene/);
    assert.match(source, /auth-runner/);
    assert.match(source, /auth-lane/);
    assert.match(source, /auth-brand/);
  }

  assert.match(verifyAccessPageSource, /auth-brand--login/);
  assert.doesNotMatch(verifyAccessPageSource, /<h1 className="auth-title">登录<\/h1>/);
  assert.match(createAccessPageSource, /auth-title/);
  assert.match(globalsSource, /\.auth-page::before/);
  assert.match(globalsSource, /\.auth-page::after/);
  assert.match(globalsSource, /@keyframes auth-scene-drift/);
  assert.match(globalsSource, /@keyframes auth-track-flow/);
  assert.match(globalsSource, /@keyframes auth-runner-pulse/);
  assert.match(globalsSource, /\.auth-brand\s*{[^}]*font-size:\s*24px/s);
  assert.match(globalsSource, /\.auth-brand--login\s*{[^}]*font-size:\s*34px/s);
  assert.match(globalsSource, /\.auth-card__header\s*{[^}]*text-align:\s*center/s);
  assert.match(globalsSource, /\.auth-title\s*{[^}]*font-size:\s*42px/s);
  assert.match(globalsSource, /\.auth-title\s*{[^}]*text-align:\s*center/s);
});

test("login success shows a one-time welcome toast on the home page", () => {
  assert.match(verifySubmitRouteSource, /addWelcomeSearchParam/);
  assert.match(verifySubmitRouteSource, /url\.searchParams\.set\("welcome"/);
  assert.match(verifySubmitRouteSource, /result\.displayName \|\| result\.username/);
  assert.match(pageSource, /searchParams/);
  assert.match(pageSource, /LoginWelcomeToast/);
  assert.match(pageSource, /welcomeName/);
  assert.match(loginWelcomeToastSource, /欢迎\{name\}/);
  assert.match(loginWelcomeToastSource, /history\.replaceState/);
  assert.match(loginWelcomeToastSource, /url\.searchParams\.delete\("welcome"\)/);
  assert.match(globalsSource, /\.login-welcome-toast/);
  assert.match(globalsSource, /@keyframes login-welcome-pop/);
});

test("cloud deploy cleans old release directories after switching current", () => {
  assert.match(deployCloudSource, /DEPLOY_KEEP_RELEASES/);
  assert.match(deployCloudSource, /readPositiveIntegerEnv\("DEPLOY_KEEP_RELEASES", "3"\)/);
  assert.match(deployCloudSource, /touch \$\{shellQuote\(remotePackageRoot\)\}/);
  assert.match(deployCloudSource, /slimming-assistant-\*\.tar\.gz/);
  assert.match(deployCloudSource, /slimming-assistant-\[0-9\]\*/);
  assert.match(deployCloudSource, /rm -rf -- "\$old_dir"/);
});

test("cloud deploy can recreate the Baota Node project", () => {
  assert.equal(packageSource.scripts["bt:ensure-project"], "node scripts/ensure-bt-node-project.mjs");
  assert.match(deployCloudSource, /DEPLOY_BT_PROJECT/);
  assert.match(deployCloudSource, /restartApp && process\.env\.DEPLOY_BT_PROJECT !== "0"/);
  assert.match(deployCloudSource, /scripts\/ensure-bt-node-project\.mjs/);
  assert.match(ensureBtNodeProjectSource, /DEPLOY_BT_PROJECT_NAME/);
  assert.match(ensureBtNodeProjectSource, /slimming_assistant/);
  assert.match(ensureBtNodeProjectSource, /DEPLOY_BT_DOMAINS/);
  assert.match(ensureBtNodeProjectSource, /www\.hangge\.xyz/);
  assert.match(ensureBtNodeProjectSource, /mod\.project\.nodejs\.nodeMod/);
  assert.match(ensureBtNodeProjectSource, /\/usr\/bin\/env SQLITE_PATH=/);
  assert.match(ensureBtNodeProjectSource, /start_project\(get\)/);
  assert.match(ensureBtNodeProjectSource, /nginx -t/);
});

test("production start runs protected reminder checks on a timer", () => {
  assert.match(startBtSource, /INTERNAL_REMINDER_TOKEN/);
  assert.match(startBtSource, /REMINDER_CHECK_INTERVAL_MS/);
  assert.match(startBtSource, /setInterval/);
  assert.match(startBtSource, /\/api\/reminders\/run/);
  assert.match(reminderRunRouteSource, /x-internal-reminder-token/);
  assert.match(reminderRunRouteSource, /runReminderChecksForActiveUsers/);
  assert.match(reminderSchedulerSource, /createUserRepository/);
  assert.match(reminderSchedulerSource, /createRecordsRepository\(appDb, user\.id\)/);
  assert.match(reminderSchedulerSource, /createSettingsRepository\(appDb, user\.id\)/);
  assert.match(reminderSchedulerSource, /DEFAULT_ADMIN_USER_ID/);
});

test("桌面端主内容使用可用宽度，不固定在窄容器中", () => {
  assert.match(globalsSource, /max-width: 1680px/);
  assert.match(globalsSource, /max-width: 1180px/);
  assert.match(globalsSource, /\.home-main/);
  assert.match(globalsSource, /\.workbench-main/);
  assert.doesNotMatch(globalsSource, /\.page-main\s*{[^}]*max-width:\s*1200px/s);
});

test("基础质量命令存在", () => {
  assert.equal(packageSource.scripts.typecheck, "next typegen && tsc --noEmit");
  assert.ok(packageSource.scripts.lint);
  assert.ok(packageSource.scripts.build);
  assert.ok(packageSource.scripts.dev);
  assert.equal(packageSource.scripts.release, "npm run build && node scripts/create-release-package.mjs");
  assert.equal(packageSource.scripts["start:bt:3000"], "node scripts/start-bt.mjs --port 3000");
  assert.ok(packageSource.scripts.check);
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
  assert.match(saveHealthRecordActionSource, /requireAuthContext/);
  assert.match(saveHealthRecordActionSource, /createRecordsRepositoryForAuth/);
  assert.match(saveHealthRecordActionSource, /saveHealthRecord/);
  assert.doesNotMatch(saveHealthRecordActionSource, /\.insert\(|\.update\(|\.delete\(/);
});

test("跑步记录保存入口受保护并复用 records service", () => {
  assert.match(saveRunRecordActionSource, /requireAuthContext/);
  assert.match(saveRunRecordActionSource, /createRecordsRepositoryForAuth/);
  assert.match(saveRunRecordActionSource, /createRunRecord/);
  assert.doesNotMatch(saveRunRecordActionSource, /\.insert\(|\.update\(|\.delete\(/);
});

test("历史编辑和删除入口受保护并复用 records service", () => {
  for (const source of [updateHealthRecordActionSource, updateRunRecordActionSource, deleteRecordActionSource]) {
    assert.match(source, /requireAuthContext/);
    assert.match(source, /createRecordsRepositoryForAuth/);
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
  assert.match(recordsPageSource, /打卡工作台/);
  assert.match(recordsPageSource, /今天的数据，今天留下证据/);
  assert.match(recordsPageSource, /RecordDatePicker/);
  assert.match(recordsPageSource, /localDate=\{localDate\}/);

  for (const source of [saveHealthRecordActionSource, saveRunRecordActionSource]) {
    assert.match(source, /formData\.get\("localDate"\)/);
    assert.match(source, /localDate,/);
    assert.match(source, /revalidatePath\("\/history"\)/);
  }
});

test("健康目标保存入口受保护并复用 goals service", () => {
  assert.match(saveHealthGoalActionSource, /requireAuthContext/);
  assert.match(saveHealthGoalActionSource, /createGoalsRepositoryForAuth/);
  assert.match(saveHealthGoalActionSource, /saveHealthGoal/);
  assert.doesNotMatch(saveHealthGoalActionSource, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(goalSettingsSectionSource, /getHealthGoal/);
  assert.match(goalsPageSource, /requireAuthContext/);
});

test("跑步目标保存入口受保护并复用 goals service", () => {
  assert.match(saveRunGoalActionSource, /requireAuthContext/);
  assert.match(saveRunGoalActionSource, /createGoalsRepositoryForAuth/);
  assert.match(saveRunGoalActionSource, /saveRunGoal/);
  assert.doesNotMatch(saveRunGoalActionSource, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(goalSettingsSectionSource, /getRunGoal/);
});

test("设置页受保护并且不直接写数据库", () => {
  assert.match(settingsPageSource, /requireUserAuthContext/);
  assert.doesNotMatch(settingsPageSource, /\.insert\(|\.update\(|\.delete\(/);
});

test("个人资料保存入口受保护并复用 settings service", () => {
  assert.match(saveProfileActionSource, /requireUserAuthContext/);
  assert.match(saveProfileActionSource, /createSettingsRepositoryForAuth/);
  assert.match(saveProfileActionSource, /saveProfileSettings/);
  assert.doesNotMatch(saveProfileActionSource, /\.insert\(|\.update\(|\.delete\(/);
});

test("收件邮箱保存入口受保护并保存到当前用户设置", () => {
  assert.match(settingsPageSource, /邮件接收/);
  assert.match(recipientEmailFormStateSource, /initialRecipientEmailFormState/);
  assert.match(recipientEmailFormStateSource, /initialRecipientEmailTestFormState/);
  assert.match(saveRecipientEmailActionSource, /requireUserAuthContext/);
  assert.match(saveRecipientEmailActionSource, /createSettingsRepositoryForAuth/);
  assert.match(saveRecipientEmailActionSource, /getProfileSettings/);
  assert.match(saveRecipientEmailActionSource, /saveProfileSettings/);
  assert.match(sendRecipientTestEmailActionSource, /requireUserAuthContext/);
  assert.match(sendRecipientTestEmailActionSource, /createGlobalSettingsRepository/);
  assert.match(sendRecipientTestEmailActionSource, /sendTestEmail/);
  assert.doesNotMatch(sendRecipientTestEmailActionSource, /auth\.role !== "admin"/);
  assert.match(recipientEmailFormSource, /sendRecipientTestEmailAction/);
  assert.match(recipientEmailFormSource, /formAction=\{testAction\}/);
  assert.doesNotMatch(saveRecipientEmailActionSource, /export const/);
  assert.doesNotMatch(saveRecipientEmailActionSource, /\.insert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(sendRecipientTestEmailActionSource, /\.insert\(|\.update\(|\.delete\(/);
});

test("趋势阈值保存入口受保护并复用 settings service", () => {
  assert.match(saveTrendThresholdActionSource, /requireUserAuthContext/);
  assert.match(saveTrendThresholdActionSource, /createSettingsRepositoryForAuth/);
  assert.match(saveTrendThresholdActionSource, /saveTrendThresholdSettings/);
  assert.doesNotMatch(saveTrendThresholdActionSource, /\.insert\(|\.update\(|\.delete\(/);
});

test("提醒规则保存入口受保护并复用 settings service", () => {
  assert.match(saveReminderRuleActionSource, /requireUserAuthContext/);
  assert.match(saveReminderRuleActionSource, /createSettingsRepositoryForAuth/);
  assert.match(saveReminderRuleActionSource, /saveReminderRuleSettings/);
  assert.doesNotMatch(saveReminderRuleActionSource, /\.insert\(|\.update\(|\.delete\(/);
});

test("SMTP 配置和测试邮件入口受保护并复用 settings service", () => {
  for (const source of [saveSmtpConfigActionSource, sendTestEmailActionSource]) {
    assert.match(source, /requireUserAuthContext/);
    assert.match(source, /createGlobalSettingsRepository/);
    assert.match(source, /auth\.role !== "admin"/);
    assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(/);
  }

  assert.match(saveSmtpConfigActionSource, /saveSmtpConfig/);
  assert.match(sendTestEmailActionSource, /sendTestEmail/);
});

test("访问保护设置入口受保护并复用 access service", () => {
  for (const source of [changeAccessPasswordActionSource, revokeTrustedDeviceActionSource]) {
    assert.match(source, /requireUserAuthContext/);
    assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(/);
  }

  assert.match(changeAccessPasswordActionSource, /changeUserPassword/);
  assert.match(revokeTrustedDeviceActionSource, /revokeTrustedDevice/);
});

test("管理员用户管理入口受保护并复用用户服务", () => {
  assert.match(settingsPageSource, /UserManagementPanel/);
  assert.match(settingsPageSource, /createUserRepository/);
  assert.match(settingsPageSource, /group\.title !== "用户管理"/);
  assert.match(userManagementPanelSource, /createManagedUserAction/);
  assert.match(userManagementPanelSource, /updateManagedUserAction/);
  assert.match(userManagementPanelSource, /disableManagedUserAction/);
  assert.match(createManagedUserActionSource, /requireUserAuthContext/);
  assert.match(createManagedUserActionSource, /auth\.role !== "admin"/);
  assert.match(createManagedUserActionSource, /createManagedUser/);
  assert.match(manageUsersActionSource, /requireUserAuthContext/);
  assert.match(manageUsersActionSource, /updateManagedUser/);
  assert.match(manageUsersActionSource, /disableManagedUser/);
  assert.match(manageUsersActionSource, /confirmDisable/);
  assert.doesNotMatch(createManagedUserActionSource, /\.insert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(manageUsersActionSource, /\.insert\(|\.update\(|\.delete\(/);
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
    for (const protectedPath of ["/", "/records", "/data", "/history", "/goals", "/settings"]) {
      const unauthenticated = await fetch(`${actualBaseUrl}${protectedPath}`, { redirect: "manual" });
      assert.ok(
        unauthenticated.status >= 300 && unauthenticated.status < 400,
        `expected redirect for ${protectedPath}, received ${unauthenticated.status}`,
      );
      assert.match(unauthenticated.headers.get("location") ?? "", /\/access\/verify$/);
    }

    for (const [path, expectedText] of [
      ["/", "今日打卡"],
      ["/records", "打卡工作台"],
      ["/data", "数据看板"],
      ["/history", "历史记录"],
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
        assert.match(html, /目标体重/);
        assert.match(html, /目标腰围/);
        assert.match(html, /本周跑量/);
        assert.match(html, /累计跑量/);
        assert.match(html, /苏ICP备2026044129号/);
        assert.doesNotMatch(html, /趋势和 BMI/);
      }

      if (path === "/data") {
        assert.match(html, /数据摘要/);
        assert.match(html, /目标进度/);
        assert.match(html, /健康目标进度/);
        assert.match(html, /跑步目标进度/);
        assert.match(html, /目标完成度/);
        assert.match(html, /数据曲线/);
        assert.match(html, /健康曲线/);
        assert.match(html, /运动曲线/);
        assert.match(html, /每日跑量/);
        assert.match(html, /最近 7 天/);
        assert.match(html, /最近半年/);
        assert.match(html, /最近 1 年/);
        assert.match(html, /最近 30 天/);
        assert.match(html, /BMI/);
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
        assert.match(html, /邮件接收/);
        assert.match(html, /提醒收件邮箱/);
        assert.match(html, /SMTP 发信服务器由管理员统一维护/);
        assert.match(html, /发送测试邮件/);
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
        assert.match(html, /用户管理/);
        assert.match(html, /新增用户/);
        assert.match(html, /普通用户/);
        assert.match(html, /保存修改/);
        assert.match(html, /停用用户/);
        assert.match(html, /确认停用此用户/);
      }
    }
    const guestHome = await fetch(`${actualBaseUrl}/`, {
      headers: { cookie: "slimming_guest_session=test-guest-nav" },
    });
    const guestHomeHtml = await guestHome.text();
    assert.equal(guestHome.status, 200);
    assert.match(guestHomeHtml, /href="\/records"/);
    assert.match(guestHomeHtml, /href="\/data"/);
    assert.match(guestHomeHtml, /href="\/history"/);
    assert.doesNotMatch(guestHomeHtml, /href="\/settings"/);

    const guestSettings = await fetch(`${actualBaseUrl}/settings`, {
      headers: { cookie: "slimming_guest_session=test-guest-nav" },
      redirect: "manual",
    });
    assert.ok(guestSettings.status >= 300 && guestSettings.status < 400);
    assert.match(guestSettings.headers.get("location") ?? "", /\/$/);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([
        once(child, "exit"),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
    }
    await accessDb.cleanup();
  }
});
