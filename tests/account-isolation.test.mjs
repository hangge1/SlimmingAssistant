import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createGoalsRepository } from "../features/goals/repositories/goals-repository.ts";
import { saveHealthGoal } from "../features/goals/services/goals-service.ts";
import { createGuestGoalsRepository, createGuestRecordsRepository } from "../features/guest/repositories/guest-repositories.ts";
import { createRecordsRepository } from "../features/records/repositories/records-repository.ts";
import { saveHealthRecord } from "../features/records/services/records-service.ts";
import { createReminderRepository } from "../features/reminders/repositories/reminder-repository.ts";
import { runReminderCheck } from "../features/reminders/services/reminder-runner.ts";
import { DEFAULT_ADMIN_USER_ID } from "../features/access/services/auth-context.ts";
import { createSettingsRepository } from "../features/settings/repositories/settings-repository.ts";
import { saveProfileSettings } from "../features/settings/services/profile-settings-service.ts";
import { saveReminderRuleSettings } from "../features/settings/services/reminder-rule-settings-service.ts";
import { saveSmtpConfig } from "../features/settings/services/smtp-config-service.ts";
import * as schema from "../db/schema.ts";

function createTempDb() {
  const dir = mkdtempSync(join(tmpdir(), "slimming-assistant-account-"));
  const sqlitePath = join(dir, "test.sqlite");
  const sqlite = new Database(sqlitePath);
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./db/migrations" });

  return {
    db,
    sqlite,
    cleanup() {
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("健康记录按 userId 隔离，同一天记录互不覆盖", () => {
  const { db, sqlite, cleanup } = createTempDb();

  try {
    const userA = createRecordsRepository(db, "user-a");
    const userB = createRecordsRepository(db, "user-b");

    const first = saveHealthRecord(userA, {
      localDate: "2026-07-07",
      weightKg: 82,
      nowIso: "2026-07-07T08:00:00.000Z",
    });
    const second = saveHealthRecord(userB, {
      localDate: "2026-07-07",
      weightKg: 75,
      nowIso: "2026-07-07T09:00:00.000Z",
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(userA.getHealthRecordByDate("2026-07-07").data?.weightKg, 82);
    assert.equal(userB.getHealthRecordByDate("2026-07-07").data?.weightKg, 75);
    assert.equal(sqlite.prepare("select count(*) as count from health_records").get().count, 2);
  } finally {
    cleanup();
  }
});

test("邮件提醒使用个人收件邮箱和全局 SMTP 配置", async () => {
  const { db, sqlite, cleanup } = createTempDb();

  try {
    const userRecords = createRecordsRepository(db, "user-b");
    const userReminders = createReminderRepository(db, "user-b");
    const userSettings = createSettingsRepository(db, "user-b");
    const globalSettings = createSettingsRepository(db, DEFAULT_ADMIN_USER_ID);

    saveReminderRuleSettings(userSettings, {
      reminderTime: "20:30",
      inAppEnabled: false,
      emailEnabled: true,
      nowIso: "2026-07-07T08:00:00.000Z",
    });
    saveProfileSettings(userSettings, {
      nickname: "",
      heightCm: null,
      reminderEmail: "user-b@example.com",
      nowIso: "2026-07-07T08:00:00.000Z",
    });
    saveSmtpConfig(globalSettings, {
      host: "smtp.global.example.com",
      port: 465,
      username: "global-user",
      password: "global-secret",
      fromEmail: "admin@example.com",
      secureMode: "ssl",
      nowIso: "2026-07-07T08:00:00.000Z",
    });

    const sentMessages = [];
    const result = await runReminderCheck({
      recordsRepository: userRecords,
      reminderRepository: userReminders,
      settingsRepository: userSettings,
      smtpSettingsRepository: globalSettings,
      localDate: "2026-07-07",
      currentTime: "21:00",
      nowIso: "2026-07-07T13:00:00.000Z",
      mailTransportFactory(config) {
        assert.equal(config.host, "smtp.global.example.com");
        assert.deepEqual(config.auth, { user: "global-user", pass: "global-secret" });
        return {
          async sendMail(input) {
            sentMessages.push(input);
            return { messageId: "mail-id" };
          },
        };
      },
    });

    assert.equal(result.ok, true);
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].from, "admin@example.com");
    assert.equal(sentMessages[0].to, "user-b@example.com");
    assert.equal(sqlite.prepare("select user_id from reminder_events where channel = 'email'").get().user_id, "user-b");
  } finally {
    cleanup();
  }
});

test("新访客会话不会预置示例数据", () => {
  const sessionId = `guest-empty-${Date.now()}`;
  const recordsRepository = createGuestRecordsRepository(sessionId);
  const goalsRepository = createGuestGoalsRepository(sessionId);

  assert.deepEqual(recordsRepository.listHealthRecords().data, []);
  assert.deepEqual(recordsRepository.listRunRecords().data, []);
  assert.deepEqual(goalsRepository.listGoals().data, []);
});

test("目标按 userId 隔离，同一类型目标互不覆盖", () => {
  const { db, sqlite, cleanup } = createTempDb();

  try {
    const userA = createGoalsRepository(db, "user-a");
    const userB = createGoalsRepository(db, "user-b");

    assert.equal(saveHealthGoal(userA, { targetWeightKg: 72, nowIso: "2026-07-07T08:00:00.000Z" }).ok, true);
    assert.equal(saveHealthGoal(userB, { targetWeightKg: 68, nowIso: "2026-07-07T09:00:00.000Z" }).ok, true);

    assert.equal(userA.getGoalByType("health").data?.targetWeightKg, 72);
    assert.equal(userB.getGoalByType("health").data?.targetWeightKg, 68);
    assert.equal(sqlite.prepare("select count(*) as count from goals").get().count, 2);
  } finally {
    cleanup();
  }
});
