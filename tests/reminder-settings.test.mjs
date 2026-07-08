import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createUserRepository } from "../features/access/repositories/user-repository.ts";
import { DEFAULT_ADMIN_USER_ID } from "../features/access/services/auth-context.ts";
import { createRecordsRepository } from "../features/records/repositories/records-repository.ts";
import { createReminderRepository } from "../features/reminders/repositories/reminder-repository.ts";
import { runReminderChecksForActiveUsers } from "../features/reminders/services/reminder-scheduler.ts";
import { runReminderCheck } from "../features/reminders/services/reminder-runner.ts";
import { createSettingsRepository } from "../features/settings/repositories/settings-repository.ts";
import { saveProfileSettings } from "../features/settings/services/profile-settings-service.ts";
import { parseReminderRuleFormValues } from "../features/settings/services/reminder-rule-input.ts";
import { getReminderRuleSettings, saveReminderRuleSettings } from "../features/settings/services/reminder-rule-settings-service.ts";
import { saveSmtpConfig } from "../features/settings/services/smtp-config-service.ts";
import * as schema from "../db/schema.ts";

function createTempRepositories() {
  const dir = mkdtempSync(join(tmpdir(), "slimming-assistant-reminder-"));
  const sqlitePath = join(dir, "test.sqlite");
  const sqlite = new Database(sqlitePath);
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./db/migrations" });

  return {
    db,
    recordsRepository: createRecordsRepository(db),
    reminderRepository: createReminderRepository(db),
    settingsRepository: createSettingsRepository(db),
    sqlite,
    cleanup() {
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("提醒规则输入会校验时间格式", () => {
  const parsed = parseReminderRuleFormValues({
    reminderTime: "25:00",
    inAppEnabled: "on",
    emailEnabled: "",
  });

  assert.equal(parsed.ok, false);
  assert.equal(parsed.ok ? "" : parsed.fieldErrors.reminderTime, "提醒时间必须是 HH:mm 格式");
});

test("提醒规则可以保存并读取", () => {
  const { settingsRepository, cleanup } = createTempRepositories();

  try {
    const saved = saveReminderRuleSettings(settingsRepository, {
      reminderTime: "20:30",
      inAppEnabled: true,
      emailEnabled: false,
      nowIso: "2026-06-26T00:00:00.000Z",
    });
    const loaded = getReminderRuleSettings(settingsRepository);

    assert.equal(saved.ok, true);
    assert.deepEqual(loaded.ok ? loaded.data : null, {
      reminderTime: "20:30",
      inAppEnabled: true,
      emailEnabled: false,
    });
  } finally {
    cleanup();
  }
});

test("ReminderRunner 会幂等生成站内提醒", async () => {
  const { recordsRepository, reminderRepository, settingsRepository, sqlite, cleanup } = createTempRepositories();

  try {
    saveReminderRuleSettings(settingsRepository, {
      reminderTime: "20:30",
      inAppEnabled: true,
      emailEnabled: false,
      nowIso: "2026-06-26T00:00:00.000Z",
    });

    const first = await runReminderCheck({
      recordsRepository,
      reminderRepository,
      settingsRepository,
      localDate: "2026-06-26",
      currentTime: "21:00",
      nowIso: "2026-06-26T13:00:00.000Z",
    });
    const second = await runReminderCheck({
      recordsRepository,
      reminderRepository,
      settingsRepository,
      localDate: "2026-06-26",
      currentTime: "21:10",
      nowIso: "2026-06-26T13:10:00.000Z",
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(sqlite.prepare("select count(*) as count from reminder_events").get().count, 1);
  } finally {
    cleanup();
  }
});

test("ReminderRunner 会发送邮件提醒并记录成功状态", async () => {
  const { recordsRepository, reminderRepository, settingsRepository, sqlite, cleanup } = createTempRepositories();

  try {
    saveReminderRuleSettings(settingsRepository, {
      reminderTime: "20:30",
      inAppEnabled: false,
      emailEnabled: true,
      nowIso: "2026-06-26T00:00:00.000Z",
    });
    saveProfileSettings(settingsRepository, {
      nickname: "",
      heightCm: null,
      reminderEmail: "to@example.com",
      nowIso: "2026-06-26T00:00:00.000Z",
    });
    saveSmtpConfig(settingsRepository, {
      host: "smtp.example.com",
      port: 465,
      username: "user",
      password: "secret",
      fromEmail: "me@example.com",
      secureMode: "ssl",
      nowIso: "2026-06-26T00:00:00.000Z",
    });

    const sent = await runReminderCheck({
      recordsRepository,
      reminderRepository,
      settingsRepository,
      localDate: "2026-06-26",
      currentTime: "21:00",
      nowIso: "2026-06-26T13:00:00.000Z",
      mailTransportFactory() {
        return { sendMail: async () => ({ messageId: "mail-id" }) };
      },
    });

    assert.equal(sent.ok, true);
    assert.equal(sqlite.prepare("select status from reminder_events where channel = 'email'").get().status, "sent");
  } finally {
    cleanup();
  }
});

test("ReminderScheduler 会按启用用户执行并使用管理员 SMTP 配置", async () => {
  const { db, sqlite, cleanup } = createTempRepositories();

  try {
    const userRepository = createUserRepository(db);
    const nowIso = "2026-06-26T00:00:00.000Z";
    const activeUser = userRepository.createUser({
      username: "active",
      displayName: "Active",
      role: "user",
      passwordHash: "hash",
      passwordHashAlgorithm: "test",
      nowIso,
    });
    const disabledUser = userRepository.createUser({
      username: "disabled",
      displayName: "Disabled",
      role: "user",
      passwordHash: "hash",
      passwordHashAlgorithm: "test",
      nowIso,
    });

    assert.equal(activeUser.ok, true);
    assert.equal(disabledUser.ok, true);
    userRepository.disableUser(disabledUser.ok ? disabledUser.data.id : "", nowIso);

    const globalSettings = createSettingsRepository(db, DEFAULT_ADMIN_USER_ID);
    saveSmtpConfig(globalSettings, {
      host: "smtp.global.example.com",
      port: 465,
      username: "smtp-user",
      password: "smtp-secret",
      fromEmail: "admin@example.com",
      secureMode: "ssl",
      nowIso,
    });

    for (const user of [activeUser.ok ? activeUser.data : null, disabledUser.ok ? disabledUser.data : null]) {
      assert.ok(user);
      const userSettings = createSettingsRepository(db, user.id);
      saveReminderRuleSettings(userSettings, {
        reminderTime: "20:30",
        inAppEnabled: false,
        emailEnabled: true,
        nowIso,
      });
      saveProfileSettings(userSettings, {
        nickname: "",
        heightCm: null,
        reminderEmail: `${user.username}@example.com`,
        nowIso,
      });
    }

    const sentTo = [];
    const result = await runReminderChecksForActiveUsers({
      appDb: db,
      now: new Date("2026-06-26T13:00:00.000Z"),
      timeZone: "Asia/Shanghai",
      mailTransportFactory(config) {
        assert.equal(config.host, "smtp.global.example.com");
        return {
          async sendMail(input) {
            sentTo.push(input.to);
            return { messageId: "mail-id" };
          },
        };
      },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(sentTo, ["active@example.com"]);
    assert.equal(sqlite.prepare("select count(*) as count from reminder_events where channel = 'email'").get().count, 1);
    assert.equal(
      sqlite.prepare("select user_id from reminder_events where channel = 'email'").get().user_id,
      activeUser.ok ? activeUser.data.id : "",
    );
  } finally {
    cleanup();
  }
});

test("ReminderRunner 会记录邮件发送失败状态", async () => {
  const { recordsRepository, reminderRepository, settingsRepository, sqlite, cleanup } = createTempRepositories();

  try {
    saveReminderRuleSettings(settingsRepository, {
      reminderTime: "20:30",
      inAppEnabled: false,
      emailEnabled: true,
      nowIso: "2026-06-26T00:00:00.000Z",
    });
    saveProfileSettings(settingsRepository, {
      nickname: "",
      heightCm: null,
      reminderEmail: "to@example.com",
      nowIso: "2026-06-26T00:00:00.000Z",
    });
    saveSmtpConfig(settingsRepository, {
      host: "smtp.example.com",
      port: 465,
      username: "user",
      password: "secret",
      fromEmail: "me@example.com",
      secureMode: "ssl",
      nowIso: "2026-06-26T00:00:00.000Z",
    });

    const sent = await runReminderCheck({
      recordsRepository,
      reminderRepository,
      settingsRepository,
      localDate: "2026-06-26",
      currentTime: "21:00",
      nowIso: "2026-06-26T13:00:00.000Z",
      mailTransportFactory() {
        return { sendMail: async () => { throw new Error("mail down"); } };
      },
    });

    assert.equal(sent.ok, true);
    const row = sqlite.prepare("select status, message from reminder_events where channel = 'email'").get();
    assert.equal(row.status, "failed");
    assert.match(row.message, /邮件提醒发送失败/);
  } finally {
    cleanup();
  }
});
