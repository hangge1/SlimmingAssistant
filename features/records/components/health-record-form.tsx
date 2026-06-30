"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveHealthRecordAction } from "../actions/save-health-record";
import {
  initialHealthRecordFormState,
  type HealthRecordFormState,
} from "../actions/health-record-form-state";

type HealthRecordFormProps = {
  initialState: HealthRecordFormState;
  localDate: string;
};

const fields = [
  { name: "weightKg", label: "体重", unit: "公斤", min: 40, max: 160, step: 0.1 },
  { name: "waistCm", label: "腰围", unit: "厘米", min: 50, max: 150, step: 0.1 },
  { name: "hipCm", label: "臀围", unit: "厘米", min: 60, max: 160, step: 0.1 },
  { name: "bodyFatPercentage", label: "体脂率", unit: "%", min: 5, max: 50, step: 0.1 },
] as const;

function formatOptionValue(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function buildOptions(min: number, max: number, step: number) {
  const options: string[] = [];

  for (let value = min; value <= max + step / 10; value += step) {
    options.push(formatOptionValue(value));
  }

  return options;
}

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
          const error = fieldErrors[field.name];
          const options = buildOptions(field.min, field.max, field.step);
          const currentValue = values[field.name];
          const hasCustomCurrentValue = currentValue && !options.includes(currentValue);

          return (
            <div className="grid gap-2" key={field.name}>
              <label htmlFor={field.name} className="text-sm font-semibold text-[var(--ink-primary)]">
                {field.label}
              </label>
              <div className="flex min-h-11 overflow-hidden rounded-md border border-[var(--border-soft)] bg-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--primary)]">
                <select
                  id={field.name}
                  name={field.name}
                  defaultValue={currentValue}
                  aria-describedby={error ? errorId : undefined}
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-[var(--ink-primary)] outline-none"
                >
                  <option value="">请选择{field.label}</option>
                  {hasCustomCurrentValue ? <option value={currentValue}>{currentValue}</option> : null}
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span className="flex min-w-12 items-center justify-center border-l border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-secondary)]">
                  {field.unit}
                </span>
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
          完成健康打卡
        </Button>
      </div>
    </form>
  );
}
