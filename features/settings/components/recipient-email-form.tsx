"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { initialRecipientEmailFormState, type RecipientEmailFormState } from "../actions/recipient-email-form-state";
import { saveRecipientEmailAction } from "../actions/save-recipient-email";

type RecipientEmailFormProps = {
  initialState: RecipientEmailFormState;
};

export function RecipientEmailForm({ initialState }: RecipientEmailFormProps) {
  const [state, formAction, pending] = useActionState(saveRecipientEmailAction, initialState);
  const values = state?.values ?? initialState.values ?? initialRecipientEmailFormState.values;
  const fieldErrors = state?.fieldErrors ?? initialRecipientEmailFormState.fieldErrors;

  return (
    <form action={formAction} className="grid gap-4">
      {state?.successMessage ? (
        <p className="rounded-md border border-[var(--health)] bg-[var(--health-soft)] px-3 py-2 text-sm text-[var(--ink-primary)]">
          {state.successMessage}
        </p>
      ) : null}

      {fieldErrors.form ? (
        <p className="rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {fieldErrors.form}
        </p>
      ) : null}

      <div className="grid gap-2">
        <label htmlFor="reminderEmail" className="text-sm font-semibold text-[var(--ink-primary)]">
          提醒收件邮箱
        </label>
        <input
          id="reminderEmail"
          name="reminderEmail"
          defaultValue={values.reminderEmail}
          inputMode="email"
          placeholder="name@example.com"
          aria-describedby={fieldErrors.reminderEmail ? "reminderEmail-error" : undefined}
          className="min-h-11 rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm text-[var(--ink-primary)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary)]"
        />
        {fieldErrors.reminderEmail ? (
          <p id="reminderEmail-error" className="text-sm text-[var(--danger)]">
            {fieldErrors.reminderEmail}
          </p>
        ) : null}
      </div>

      <p className="m-0 text-sm text-[var(--ink-secondary)]">
        这里只设置当前账号接收提醒的邮箱；SMTP 发信服务器由管理员统一维护。
      </p>

      <div>
        <Button type="submit" disabled={pending}>
          保存收件邮箱
        </Button>
      </div>
    </form>
  );
}
