import type { Goal } from "@/db/schema";
import { createGoalsRepository } from "@/features/goals/repositories/goals-repository";
import { getHealthGoal, getRunGoal } from "@/features/goals/services/goals-service";
import { healthGoalToFormValues } from "@/features/goals/actions/health-goal-form-state";
import { runGoalToFormValues } from "@/features/goals/actions/run-goal-form-state";
import { HealthGoalForm } from "./health-goal-form";
import { RunGoalForm } from "./run-goal-form";

function formatOptionalValue(value: number | null, unit: string) {
  return value == null ? "未设置" : `${value} ${unit}`;
}

function HealthGoalSummary({ goal }: { goal: Goal | null }) {
  if (!goal) {
    return (
      <div className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 py-3">
        <p className="m-0 text-sm text-[var(--ink-secondary)]">
          还没有设置健康目标。先填写目标体重和目标腰围，首页会直接展示差距和预计剩余时间。
        </p>
      </div>
    );
  }

  const items = [
    { label: "目标体重", value: `${goal.targetWeightKg} 公斤` },
    { label: "目标腰围", value: formatOptionalValue(goal.targetWaistCm, "厘米") },
    { label: "目标臀围", value: formatOptionalValue(goal.targetHipCm, "厘米") },
    { label: "目标体脂率", value: formatOptionalValue(goal.targetBodyFatPercentage, "%") },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div
          className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 py-2"
          key={item.label}
        >
          <p className="m-0 text-xs font-semibold text-[var(--ink-secondary)]">{item.label}</p>
          <p className="m-0 mt-1 text-base font-semibold text-[var(--ink-primary)]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function RunGoalSummary({ goal }: { goal: Goal | null }) {
  if (!goal) {
    return (
      <div className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 py-3">
        <p className="m-0 text-sm text-[var(--ink-secondary)]">
          还没有设置跑步目标。填写每周次数和跑量后，首页会用它督促本周行动。
        </p>
      </div>
    );
  }

  const items = [
    { label: "每周跑步次数", value: `${goal.weeklyRunCount} 次` },
    { label: "每周跑量", value: `${goal.weeklyDistanceKm} 公里` },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div
          className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 py-2"
          key={item.label}
        >
          <p className="m-0 text-xs font-semibold text-[var(--ink-secondary)]">{item.label}</p>
          <p className="m-0 mt-1 text-base font-semibold text-[var(--ink-primary)]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function GoalSettingsSection() {
  const repository = createGoalsRepository();
  const healthGoal = getHealthGoal(repository);
  const runGoal = getRunGoal(repository);
  const healthGoalError =
    !healthGoal.ok && "error" in healthGoal ? healthGoal.error.message : "目标数据读取失败";
  const runGoalError = !runGoal.ok && "error" in runGoal ? runGoal.error.message : "目标数据读取失败";
  const currentHealthGoal = healthGoal.ok ? healthGoal.data : null;
  const currentRunGoal = runGoal.ok ? runGoal.data : null;
  const initialHealthGoalState = {
    values: healthGoalToFormValues(currentHealthGoal),
    fieldErrors: healthGoal.ok ? {} : { form: healthGoalError },
  };
  const initialRunGoalState = {
    values: runGoalToFormValues(currentRunGoal),
    fieldErrors: runGoal.ok ? {} : { form: runGoalError },
  };

  return (
    <section aria-labelledby="goal-settings" className="card p-5">
      <div className="mb-5">
        <p className="m-0 text-sm font-semibold text-[var(--ink-secondary)]">目标反馈</p>
        <h2 id="goal-settings" className="m-0 mt-2 text-xl font-semibold text-[var(--ink-primary)]">
          设置目标，首页才会告诉你还差多少
        </h2>
        <p className="m-0 mt-2 text-sm text-[var(--ink-secondary)]">
          健康目标负责体重和围度，跑步目标负责每周行动。设置后，首页和数据页都会自动更新。
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-md border border-[var(--health)] bg-[var(--health-soft)] p-4">
          <div className="mb-4">
            <h3 className="m-0 text-lg font-semibold text-[var(--ink-primary)]">健康目标</h3>
            <p className="m-0 mt-1 text-sm text-[var(--ink-secondary)]">优先设置目标体重和目标腰围。</p>
          </div>
          <div className="mb-4">
            <HealthGoalSummary goal={currentHealthGoal} />
          </div>
          <HealthGoalForm initialState={initialHealthGoalState} />
        </article>

        <article className="rounded-md border border-[var(--motion)] bg-[var(--motion-soft)] p-4">
          <div className="mb-4">
            <h3 className="m-0 text-lg font-semibold text-[var(--ink-primary)]">跑步目标</h3>
            <p className="m-0 mt-1 text-sm text-[var(--ink-secondary)]">设置每周次数和跑量，用来驱动打卡节奏。</p>
          </div>
          <div className="mb-4">
            <RunGoalSummary goal={currentRunGoal} />
          </div>
          <RunGoalForm initialState={initialRunGoalState} />
        </article>
      </div>
    </section>
  );
}
