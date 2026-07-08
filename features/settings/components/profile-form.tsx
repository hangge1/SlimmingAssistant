"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveProfileAction } from "../actions/save-profile";
import { initialProfileFormState, type ProfileFormState } from "../actions/profile-form-state";

type ProfileFormProps = {
  initialState: ProfileFormState;
};

const fields = [
  { name: "nickname", label: "昵称", unit: "", inputMode: "text" },
  { name: "heightCm", label: "身高", unit: "厘米", inputMode: "decimal" },
] as const;

export function ProfileForm({ initialState }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(saveProfileAction, initialState);
  const values = state?.values ?? initialState.values ?? initialProfileFormState.values;
  const fieldErrors = state?.fieldErrors ?? initialProfileFormState.fieldErrors;

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

      <div className="grid gap-3">
        {fields.map((field) => {
          const errorId = `${field.name}-error`;
          const error = fieldErrors[field.name];

          return (
            <div className="grid gap-2" key={field.name}>
              <label htmlFor={field.name} className="text-sm font-semibold text-[var(--ink-primary)]">
                {field.label}
              </label>
              <div className="flex min-h-11 overflow-hidden rounded-md border border-[var(--border-soft)] bg-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--primary)]">
                <input
                  id={field.name}
                  name={field.name}
                  defaultValue={values[field.name]}
                  inputMode={field.inputMode}
                  aria-describedby={error ? errorId : undefined}
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-[var(--ink-primary)] outline-none"
                />
                {field.unit ? (
                  <span className="flex min-w-12 items-center justify-center border-l border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-secondary)]">
                    {field.unit}
                  </span>
                ) : null}
              </div>
              {error ? (
                <p id={errorId} className="text-sm text-[var(--danger)]">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          保存个人资料
        </Button>
      </div>
    </form>
  );
}
