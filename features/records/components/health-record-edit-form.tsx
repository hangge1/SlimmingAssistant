"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateHealthRecordAction } from "../actions/update-health-record";
import type { HealthRecordEditFormState } from "../actions/health-record-edit-state";
import { healthRecordInputRules } from "../constants/record-input-rules";

type HealthRecordEditFormProps = {
  id: string;
  initialState: HealthRecordEditFormState;
};

const fields = [
  { name: "weightKg", ...healthRecordInputRules.weightKg },
  { name: "waistCm", ...healthRecordInputRules.waistCm },
  { name: "hipCm", ...healthRecordInputRules.hipCm },
  { name: "bodyFatPercentage", ...healthRecordInputRules.bodyFatPercentage },
] as const;

export function HealthRecordEditForm({ id, initialState }: HealthRecordEditFormProps) {
  const [state, formAction, pending] = useActionState(updateHealthRecordAction, initialState);
  const values = state?.values ?? initialState.values;
  const fieldErrors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4">
      <input name="id" type="hidden" value={id} />

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
        <label htmlFor="localDate" className="text-sm font-semibold text-[var(--ink-primary)]">
          日期
        </label>
        <input
          className="min-h-11 rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm text-[var(--ink-primary)]"
          defaultValue={values.localDate}
          id="localDate"
          name="localDate"
          type="date"
        />
        {fieldErrors.localDate ? <p className="text-sm text-[var(--danger)]">{fieldErrors.localDate}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          const error = fieldErrors[field.name];
          const errorId = `${field.name}-error`;
          const helperId = `${field.name}-helper`;
          const describedBy = error ? `${helperId} ${errorId}` : helperId;
          return (
            <div className="grid gap-2" key={field.name}>
              <label htmlFor={field.name} className="text-sm font-semibold text-[var(--ink-primary)]">
                {field.label}
              </label>
              <div className="flex min-h-11 overflow-hidden rounded-md border border-[var(--border-soft)] bg-white">
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-[var(--ink-primary)] outline-none"
                  defaultValue={values[field.name]}
                  id={field.name}
                  inputMode="decimal"
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  placeholder={field.placeholder}
                  aria-describedby={describedBy}
                  name={field.name}
                />
                <span className="flex min-w-12 items-center justify-center border-l border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-secondary)]">
                  {field.unit}
                </span>
              </div>
              <p id={helperId} className="text-xs font-medium text-[var(--ink-muted)]">
                {field.helper}
              </p>
              {error ? <p id={errorId} className="text-sm text-[var(--danger)]">{error}</p> : null}
            </div>
          );
        })}
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          保存修改
        </Button>
      </div>
    </form>
  );
}
