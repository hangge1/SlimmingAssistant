"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveReminderRuleAction } from "../actions/save-reminder-rule";
import { initialReminderRuleFormState, type ReminderRuleFormState } from "../actions/reminder-rule-form-state";

type ReminderRuleFormProps = {
  initialState: ReminderRuleFormState;
};

const reminderHourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const reminderMinuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function splitReminderTime(value: string) {
  if (/^\d{2}:\d{2}$/.test(value)) {
    return value.split(":") as [string, string];
  }

  return ["20", "30"] as const;
}

export function ReminderRuleForm({ initialState }: ReminderRuleFormProps) {
  const [state, formAction, pending] = useActionState(saveReminderRuleAction, initialState);
  const values = state?.values ?? initialState.values ?? initialReminderRuleFormState.values;
  const fieldErrors = state?.fieldErrors ?? initialReminderRuleFormState.fieldErrors;
  const [selectedHour, selectedMinute] = splitReminderTime(values.reminderTime);

  return (
    <form action={formAction} className="grid gap-4">
      {state?.successMessage ? (
        <p className="rounded-md border border-[var(--health)] bg-[var(--health-soft)] px-3 py-2 text-sm text-[var(--ink-primary)]">
          {state.successMessage}
        </p>
      ) : null}

      <div className="grid gap-2">
        <label htmlFor="reminderHour" className="text-sm font-semibold text-[var(--ink-primary)]">
          每日提醒时间
        </label>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <select
            id="reminderHour"
            name="reminderHour"
            defaultValue={selectedHour}
            aria-label="提醒小时"
            aria-describedby={fieldErrors.reminderTime ? "reminderTime-error" : undefined}
            className="min-h-11 rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm text-[var(--ink-primary)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary)]"
          >
            {reminderHourOptions.map((hour) => (
              <option key={hour} value={hour}>
                {hour} 时
              </option>
            ))}
          </select>
          <span className="text-sm font-semibold text-[var(--ink-secondary)]">:</span>
          <select
            id="reminderMinute"
            name="reminderMinute"
            defaultValue={selectedMinute}
            aria-label="提醒分钟"
            aria-describedby={fieldErrors.reminderTime ? "reminderTime-error" : undefined}
            className="min-h-11 rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm text-[var(--ink-primary)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary)]"
          >
            {reminderMinuteOptions.map((minute) => (
              <option key={minute} value={minute}>
                {minute} 分
              </option>
            ))}
          </select>
        </div>
        {fieldErrors.reminderTime ? (
          <p id="reminderTime-error" className="text-sm text-[var(--danger)]">
            {fieldErrors.reminderTime}
          </p>
        ) : null}
      </div>

      <label className="flex min-h-11 items-center gap-3 rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 text-sm">
        <input name="inAppEnabled" type="checkbox" defaultChecked={values.inAppEnabled === "on"} />
        <span className="font-semibold text-[var(--ink-primary)]">站内提醒</span>
      </label>

      <label className="flex min-h-11 items-center gap-3 rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 text-sm">
        <input name="emailEnabled" type="checkbox" defaultChecked={values.emailEnabled === "on"} />
        <span className="font-semibold text-[var(--ink-primary)]">邮件提醒</span>
      </label>

      <p className="m-0 text-sm text-[var(--ink-secondary)]">
        邮件提醒需要先配置 SMTP 邮件和提醒收件邮箱；未配置完整时不会发送邮件。
      </p>

      <div>
        <Button type="submit" disabled={pending}>
          保存提醒规则
        </Button>
      </div>
    </form>
  );
}
