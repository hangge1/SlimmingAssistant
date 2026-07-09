"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveHealthRecordAction } from "../actions/save-health-record";
import {
  initialHealthRecordFormState,
  type HealthRecordFormState,
} from "../actions/health-record-form-state";
import { healthRecordInputRules } from "../constants/record-input-rules";

type HealthRecordFormProps = {
  initialState: HealthRecordFormState;
  localDate: string;
};

const fields = [
  { name: "weightKg", ...healthRecordInputRules.weightKg },
  { name: "waistCm", ...healthRecordInputRules.waistCm },
  { name: "hipCm", ...healthRecordInputRules.hipCm },
  { name: "bodyFatPercentage", ...healthRecordInputRules.bodyFatPercentage },
] as const;

export function HealthRecordForm({ initialState, localDate }: HealthRecordFormProps) {
  const [state, formAction, pending] = useActionState(saveHealthRecordAction, initialState);
  const values = state?.values ?? initialState.values ?? initialHealthRecordFormState.values;
  const fieldErrors = state?.fieldErrors ?? initialHealthRecordFormState.fieldErrors;

  return (
    <form action={formAction} className="grid gap-4">
      <input name="localDate" type="hidden" value={localDate} />

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

      <div className="grid max-w-[320px] gap-3">
        {fields.map((field) => {
          const errorId = `${field.name}-error`;
          const helperId = `${field.name}-helper`;
          const error = fieldErrors[field.name];
          const describedBy = error ? `${helperId} ${errorId}` : helperId;

          return (
            <div className="grid gap-2" key={field.name}>
              <label htmlFor={field.name} className="text-sm font-semibold text-[var(--ink-primary)]">
                {field.label}
              </label>
              <div className="flex min-h-11 overflow-hidden rounded-md border border-[var(--border-soft)] bg-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--primary)]">
                <input
                  id={field.name}
                  name={field.name}
                  type="number"
                  inputMode="decimal"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  placeholder={field.placeholder}
                  defaultValue={values[field.name]}
                  aria-describedby={describedBy}
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-[var(--ink-primary)] outline-none"
                />
                <span className="flex min-w-12 items-center justify-center border-l border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-secondary)]">
                  {field.unit}
                </span>
              </div>
              <p id={helperId} className="text-xs font-medium text-[var(--ink-muted)]">
                {field.helper}
              </p>
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
          完成健康打卡
        </Button>
      </div>
    </form>
  );
}
