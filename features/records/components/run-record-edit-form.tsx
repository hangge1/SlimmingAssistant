"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { updateRunRecordAction } from "../actions/update-run-record";
import type { RunRecordEditFormState } from "../actions/run-record-edit-state";
import { calculatedPaceRule, runRecordInputRules } from "../constants/record-input-rules";

type RunRecordEditFormProps = {
  id: string;
  initialState: RunRecordEditFormState;
};

const fields = [
  { name: "distanceKm", ...runRecordInputRules.distanceKm },
  { name: "durationMinutes", ...runRecordInputRules.durationMinutes },
  { name: "averageHeartRateBpm", ...runRecordInputRules.averageHeartRateBpm },
  { name: "averageStrideMeters", ...runRecordInputRules.averageStrideMeters },
  { name: "cadenceSpm", ...runRecordInputRules.cadenceSpm },
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

export function RunRecordEditForm({ id, initialState }: RunRecordEditFormProps) {
  const [state, formAction, pending] = useActionState(updateRunRecordAction, initialState);
  const values = state?.values ?? initialState.values;
  const fieldErrors = state?.fieldErrors ?? {};
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
      <input name="id" type="hidden" value={id} />

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  id={field.name}
                  inputMode={"integer" in field && field.integer ? "numeric" : "decimal"}
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  placeholder={field.placeholder}
                  aria-describedby={describedBy}
                  name={field.name}
                  defaultValue={values[field.name]}
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

      <div className="grid gap-2">
        <span className="text-sm font-semibold text-[var(--ink-primary)]">配速</span>
        <div className="flex min-h-11 items-center justify-between rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 text-sm text-[var(--ink-secondary)]">
          <span>{calculatedPace}</span>
          <span>只读</span>
        </div>
        <p className="text-xs font-medium text-[var(--ink-muted)]">{calculatedPaceRule.helper}</p>
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          保存修改
        </Button>
      </div>
    </form>
  );
}
