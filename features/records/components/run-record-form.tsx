"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { saveRunRecordAction } from "../actions/save-run-record";
import {
  initialRunRecordFormState,
  type RunRecordFormState,
} from "../actions/run-record-form-state";

type RunRecordFormProps = {
  initialState: RunRecordFormState;
  localDate: string;
};

const fields = [
  { name: "distanceKm", label: "公里数", unit: "公里" },
  { name: "durationMinutes", label: "运动时长", unit: "分钟" },
  { name: "averageHeartRateBpm", label: "平均心率", unit: "次/分" },
  { name: "averageStrideMeters", label: "平均步幅", unit: "米" },
  { name: "cadenceSpm", label: "步频", unit: "步/分" },
] as const;

function calculatePaceText(distanceValue: string, durationValue: string) {
  const distance = Number(distanceValue);
  const duration = Number(durationValue);

  if (!Number.isFinite(distance) || distance <= 0 || !Number.isFinite(duration) || duration <= 0) {
    return "填写公里数和时长后自动计算";
  }

  const pace = Math.round((duration / distance) * 10) / 10;
  return `${pace} 分钟/公里`;
}

export function RunRecordForm({ initialState, localDate }: RunRecordFormProps) {
  const [state, formAction, pending] = useActionState(saveRunRecordAction, initialState);
  const values = state?.values ?? initialState.values ?? initialRunRecordFormState.values;
  const fieldErrors = state?.fieldErrors ?? initialRunRecordFormState.fieldErrors;
  const [calculatedPace, setCalculatedPace] = useState(
    calculatePaceText(values.distanceKm, values.durationMinutes),
  );

  function updateCalculatedPace(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    setCalculatedPace(
      calculatePaceText(
        String(formData.get("distanceKm") ?? ""),
        String(formData.get("durationMinutes") ?? ""),
      ),
    );
  }

  return (
    <form action={formAction} className="grid gap-4" onInput={updateCalculatedPace}>
      <input name="localDate" type="hidden" value={localDate} />

      {state?.successMessage ? (
        <p className="rounded-md border border-[var(--motion)] bg-[var(--motion-soft)] px-3 py-2 text-sm text-[var(--ink-primary)]">
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

          return (
            <div className="grid gap-2" key={field.name}>
              <label htmlFor={field.name} className="text-sm font-semibold text-[var(--ink-primary)]">
                {field.label}
              </label>
              <div className="flex min-h-11 overflow-hidden rounded-md border border-[var(--border-soft)] bg-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--primary)]">
                <input
                  id={field.name}
                  name={field.name}
                  inputMode="decimal"
                  aria-describedby={error ? errorId : undefined}
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-[var(--ink-primary)] outline-none"
                  defaultValue={values[field.name]}
                />
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

      <div className="grid max-w-[320px] gap-2">
        <span className="text-sm font-semibold text-[var(--ink-primary)]">配速</span>
        <div className="flex min-h-11 items-center justify-between rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-secondary)]">
          <span>{calculatedPace}</span>
          <span>只读</span>
        </div>
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          完成跑步打卡
        </Button>
      </div>
    </form>
  );
}
