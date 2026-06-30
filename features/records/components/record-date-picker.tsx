"use client";

import { useRef } from "react";

type RecordDatePickerProps = {
  id: string;
  localDate: string;
};

export function RecordDatePicker({ id, localDate }: RecordDatePickerProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action="" className="grid max-w-[240px] gap-2" method="get" ref={formRef}>
      <label htmlFor={id} className="text-sm font-semibold text-[var(--ink-primary)]">
        打卡日期
      </label>
      <input
        className="min-h-11 rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm text-[var(--ink-primary)]"
        defaultValue={localDate}
        id={id}
        name="date"
        onChange={() => formRef.current?.requestSubmit()}
        type="date"
      />
    </form>
  );
}
