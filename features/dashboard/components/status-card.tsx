const toneClass = {
  health: "bg-[#e7f7ed] text-[#15803d]",
  motion: "bg-[#e3f2fb] text-[#0369a1]",
  warning: "bg-[#fff4df] text-[#b45309]",
} as const;

const borderClass = {
  health: "border-l-[#22c55e]",
  motion: "border-l-[#0284c7]",
  warning: "border-l-[#f59e0b]",
} as const;

type StatusCardProps = {
  title: string;
  value: string;
  unit?: string;
  description: string;
  tone: keyof typeof toneClass;
};

export function StatusCard({ title, value, unit = "", description, tone }: StatusCardProps) {
  return (
    <article className={`rounded-md border border-[var(--border-soft)] border-l-4 bg-white p-4 ${borderClass[tone]}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-semibold text-[var(--ink-secondary)]">{title}</h2>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClass[tone]}`}>
          {title}
        </span>
      </div>
      <div className="flex min-h-9 items-baseline gap-2">
        <span className="text-[28px] font-bold leading-tight text-[var(--ink-primary)]">{value}</span>
        {unit ? <span className="text-sm font-semibold text-[var(--ink-secondary)]">{unit}</span> : null}
      </div>
      <p className="mt-2 text-sm text-[var(--ink-secondary)]">{description}</p>
    </article>
  );
}
