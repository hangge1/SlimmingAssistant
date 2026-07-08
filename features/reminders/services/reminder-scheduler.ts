import { getDb, type AppDb } from "../../../db/client.ts";
import { createUserRepository } from "../../access/repositories/user-repository.ts";
import { DEFAULT_ADMIN_USER_ID } from "../../access/services/auth-context.ts";
import { createRecordsRepository } from "../../records/repositories/records-repository.ts";
import { createSettingsRepository } from "../../settings/repositories/settings-repository.ts";
import { createReminderRepository } from "../repositories/reminder-repository.ts";
import { runReminderCheck } from "./reminder-runner.ts";

type MailTransportFactory = NonNullable<Parameters<typeof runReminderCheck>[0]["mailTransportFactory"]>;

type ReminderSchedulerInput = {
  appDb?: AppDb;
  now?: Date;
  timeZone?: string;
  mailTransportFactory?: MailTransportFactory;
};

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getReminderLocalNow(now = new Date(), timeZone = process.env.REMINDER_TIME_ZONE ?? "Asia/Shanghai") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const year = partValue(parts, "year");
  const month = partValue(parts, "month");
  const day = partValue(parts, "day");
  const hour = partValue(parts, "hour");
  const minute = partValue(parts, "minute");

  return {
    localDate: `${year}-${month}-${day}`,
    currentTime: `${hour}:${minute}`,
    nowIso: now.toISOString(),
  };
}

export async function runReminderChecksForActiveUsers(input: ReminderSchedulerInput = {}) {
  const appDb = input.appDb ?? getDb();
  const localNow = getReminderLocalNow(input.now, input.timeZone);
  const userRepository = createUserRepository(appDb);
  const users = userRepository.listUsers();

  if (!users.ok) {
    return { ok: false as const, fieldErrors: { form: users.error.message } };
  }

  const activeUsers = users.data.filter((user) => !user.disabledAtIso);
  const failures: Array<{ userId: string; message: string }> = [];

  for (const user of activeUsers) {
    const result = await runReminderCheck({
      recordsRepository: createRecordsRepository(appDb, user.id),
      reminderRepository: createReminderRepository(appDb, user.id),
      settingsRepository: createSettingsRepository(appDb, user.id),
      smtpSettingsRepository: createSettingsRepository(appDb, DEFAULT_ADMIN_USER_ID),
      localDate: localNow.localDate,
      currentTime: localNow.currentTime,
      nowIso: localNow.nowIso,
      mailTransportFactory: input.mailTransportFactory,
    });

    if (!result.ok) {
      failures.push({ userId: user.id, message: result.fieldErrors.form ?? "提醒检查失败" });
    }
  }

  return {
    ok: true as const,
    data: {
      checked: activeUsers.length,
      failed: failures.length,
      failures,
      ...localNow,
    },
  };
}
