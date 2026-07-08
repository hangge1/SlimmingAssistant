"use server";

import { revalidatePath } from "next/cache";
import { requireUserAuthContext } from "@/features/access/services/route-guards";
import {
  createReminderRepositoryForAuth,
  createSettingsRepositoryForAuth,
} from "@/features/access/services/scoped-repositories";
import { getReminderLocalNow } from "@/features/reminders/services/reminder-scheduler";
import { parseReminderRuleFormValues } from "../services/reminder-rule-input.ts";
import { saveReminderRuleSettings } from "../services/reminder-rule-settings-service.ts";
import { reminderRuleToFormValues, type ReminderRuleFormState } from "./reminder-rule-form-state";

function formDataToValues(formData: FormData) {
  const reminderTime = String(formData.get("reminderTime") ?? "").trim();
  const reminderHour = String(formData.get("reminderHour") ?? "").trim();
  const reminderMinute = String(formData.get("reminderMinute") ?? "").trim();

  return {
    reminderTime: reminderTime || `${reminderHour}:${reminderMinute}`,
    inAppEnabled: formData.get("inAppEnabled") === "on" ? "on" : "",
    emailEnabled: formData.get("emailEnabled") === "on" ? "on" : "",
  };
}

export async function saveReminderRuleAction(
  _previousState: ReminderRuleFormState,
  formData: FormData,
): Promise<ReminderRuleFormState> {
  const auth = await requireUserAuthContext();

  const values = formDataToValues(formData);
  const parsed = parseReminderRuleFormValues(values);

  if (!parsed.ok) {
    return {
      values: parsed.values,
      fieldErrors: parsed.fieldErrors,
    };
  }

  const saved = saveReminderRuleSettings(createSettingsRepositoryForAuth(auth), {
    ...parsed.data,
    nowIso: new Date().toISOString(),
  });

  if (!saved.ok) {
    return {
      values,
      fieldErrors: saved.fieldErrors,
    };
  }

  if (saved.data.emailEnabled) {
    createReminderRepositoryForAuth(auth).deleteReminderEventsForDateChannel(
      getReminderLocalNow().localDate,
      "email",
    );
  }

  revalidatePath("/settings");
  revalidatePath("/");

  return {
    values: reminderRuleToFormValues(saved.data),
    fieldErrors: {},
    successMessage: "已保存提醒规则",
  };
}
