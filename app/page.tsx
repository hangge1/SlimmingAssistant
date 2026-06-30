import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { GoalSettingsSection } from "@/features/goals/components/goal-settings-section";
import {
  type DashboardAntiSlacking,
  createDashboardSummary,
  type DashboardFocusMetric,
  type DashboardRunWeek,
  type DashboardTodayBattle,
} from "@/features/dashboard/services/dashboard-summary";
import { requireTrustedDevice } from "@/features/access/services/route-guards";
import { createRecordsRepository } from "@/features/records/repositories/records-repository";
import { createGoalsRepository } from "@/features/goals/repositories/goals-repository";
import { createSettingsRepository } from "@/features/settings/repositories/settings-repository";
import { getProfileSettings } from "@/features/settings/services/profile-settings-service";
import { getTrendThresholdSettings } from "@/features/settings/services/trend-threshold-settings-service";
import { getReminderRuleSettings } from "@/features/settings/services/reminder-rule-settings-service";
import { getTodayLocalDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

function FocusMetricCard({ metric }: { metric: DashboardFocusMetric }) {
  const toneClass =
    metric.tone === "health"
      ? "border-[var(--health)] bg-[var(--health-soft)]"
      : "border-[var(--warning)] bg-[var(--warning-soft)]";

  return (
    <Link
      aria-label={`${metric.label}：目标 ${metric.targetValue}${metric.targetUnit}，当前 ${metric.currentValue}${metric.currentUnit}`}
      className={`block rounded-md border p-5 ${toneClass}`}
      href={metric.href}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-semibold text-[var(--ink-secondary)]">{metric.label}</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-[52px] font-bold leading-none text-[var(--ink-primary)]">
              {metric.targetValue}
            </span>
            <span className="pb-1 text-base font-semibold text-[var(--ink-secondary)]">{metric.targetUnit}</span>
          </div>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--ink-primary)]">
          {metric.status}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-white/80 p-3">
          <p className="m-0 text-xs font-semibold text-[var(--ink-muted)]">当前真实值</p>
          <p className="m-0 mt-1 text-xl font-semibold text-[var(--ink-primary)]">
            {metric.currentValue}
            <span className="ml-1 text-sm text-[var(--ink-secondary)]">{metric.currentUnit}</span>
          </p>
        </div>
        <div className="rounded-md bg-white/80 p-3">
          <p className="m-0 text-xs font-semibold text-[var(--ink-muted)]">目标差距</p>
          <p className="m-0 mt-1 text-xl font-semibold text-[var(--ink-primary)]">{metric.gap}</p>
        </div>
        <div className="rounded-md bg-white/80 p-3">
          <p className="m-0 text-xs font-semibold text-[var(--ink-muted)]">每天变化</p>
          <p className="m-0 mt-1 text-xl font-semibold text-[var(--ink-primary)]">{metric.dailyChange}</p>
        </div>
      </div>

      <div className="mt-3 rounded-md bg-white/80 p-3">
        <p className="m-0 text-xs font-semibold text-[var(--ink-muted)]">预计剩余时间</p>
        <p className="m-0 mt-1 text-xl font-semibold text-[var(--ink-primary)]">{metric.projectedDays}</p>
      </div>
    </Link>
  );
}

function TodayBattleCard({ battle }: { battle: DashboardTodayBattle }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="m-0 text-sm font-semibold text-[var(--ink-secondary)]">今日战况</p>
          <h2 className="m-0 mt-2 text-[28px] font-semibold leading-tight text-[var(--ink-primary)]">
            {battle.title}
          </h2>
          <p className="m-0 mt-2 max-w-2xl text-sm text-[var(--ink-secondary)]">{battle.text}</p>
        </div>
        <Button asChild>
          <Link href={battle.primaryActionHref}>
            <Zap aria-hidden="true" className="size-4" />
            {battle.primaryActionLabel}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {battle.items.map((item) => (
          <Link
            className={`rounded-md border p-4 ${
              item.done
                ? "border-[var(--health)] bg-[var(--health-soft)]"
                : "border-[var(--warning)] bg-[var(--warning-soft)]"
            }`}
            href={item.href}
            key={item.label}
          >
            <p className="m-0 text-sm font-semibold text-[var(--ink-primary)]">{item.label}</p>
            <p className="m-0 mt-2 text-xl font-semibold text-[var(--ink-primary)]">{item.value}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RunWeekCard({ runWeek }: { runWeek: DashboardRunWeek }) {
  const countPercent =
    runWeek.targetCount && runWeek.targetCount > 0
      ? Math.min(100, Math.round((runWeek.completedCount / runWeek.targetCount) * 100))
      : 0;
  const distanceTarget = Number(runWeek.targetDistance);
  const distanceCurrent = Number(runWeek.completedDistance);
  const distancePercent =
    Number.isFinite(distanceTarget) && distanceTarget > 0
      ? Math.min(100, Math.round((distanceCurrent / distanceTarget) * 100))
      : 0;

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-semibold text-[var(--ink-secondary)]">本周跑步驱动</p>
          <h2 className="m-0 mt-2 text-xl font-semibold text-[var(--ink-primary)]">
            {runWeek.status === "未设置" ? "先设置跑步目标" : "用跑步把减肥推起来"}
          </h2>
          <p className="m-0 mt-2 text-sm text-[var(--ink-secondary)]">{runWeek.text}</p>
        </div>
        <span className="rounded-full bg-[var(--motion-soft)] px-3 py-1 text-xs font-semibold text-[var(--motion)]">
          {runWeek.status}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="m-0 text-sm font-semibold text-[var(--ink-secondary)]">跑步次数</p>
              <p className="m-0 mt-2 text-3xl font-bold text-[var(--ink-primary)]">
                {runWeek.completedCount}
                <span className="text-base font-semibold text-[var(--ink-secondary)]">
                  {runWeek.targetCount == null ? " 次" : ` / ${runWeek.targetCount} 次`}
                </span>
              </p>
            </div>
            <span className="text-sm font-semibold text-[var(--ink-secondary)]">
              {runWeek.remainingCount == null ? "未设置" : `还差 ${runWeek.remainingCount} 次`}
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[var(--motion)]" style={{ width: `${countPercent}%` }} />
          </div>
        </div>

        <div className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="m-0 text-sm font-semibold text-[var(--ink-secondary)]">跑步距离</p>
              <p className="m-0 mt-2 text-3xl font-bold text-[var(--ink-primary)]">
                {runWeek.completedDistance}
                <span className="text-base font-semibold text-[var(--ink-secondary)]">
                  {runWeek.targetDistance === "未设置" ? " 公里" : ` / ${runWeek.targetDistance} 公里`}
                </span>
              </p>
            </div>
            <span className="text-sm font-semibold text-[var(--ink-secondary)]">
              {runWeek.remainingDistance === "未设置" ? "未设置" : `还差 ${runWeek.remainingDistance} 公里`}
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[var(--motion)]" style={{ width: `${distancePercent}%` }} />
          </div>
        </div>
      </div>

      <Button asChild className="mt-4">
        <Link href={runWeek.href}>
          <ArrowRight aria-hidden="true" className="size-4" />
          {runWeek.status === "未设置" ? "设置跑步目标" : "去跑步打卡"}
        </Link>
      </Button>
    </section>
  );
}

function AntiSlackingCard({ antiSlacking }: { antiSlacking: DashboardAntiSlacking }) {
  const toneClass =
    antiSlacking.tone === "health"
      ? "border-[var(--health)] bg-[var(--health-soft)]"
      : antiSlacking.tone === "motion"
        ? "border-[var(--motion)] bg-[var(--motion-soft)]"
        : "border-[var(--warning)] bg-[var(--warning-soft)]";

  return (
    <section className={`rounded-md border p-5 ${toneClass}`}>
      <p className="m-0 text-sm font-semibold text-[var(--ink-secondary)]">防摆烂提醒</p>
      <h2 className="m-0 mt-2 text-xl font-semibold text-[var(--ink-primary)]">{antiSlacking.title}</h2>
      <p className="m-0 mt-2 text-sm text-[var(--ink-secondary)]">{antiSlacking.text}</p>
      <Button asChild className="mt-4">
        <Link href={antiSlacking.href}>
          <Zap aria-hidden="true" className="size-4" />
          {antiSlacking.actionLabel}
        </Link>
      </Button>
    </section>
  );
}

export default async function Home() {
  await requireTrustedDevice();

  const settingsRepository = createSettingsRepository();
  const profile = getProfileSettings(settingsRepository);
  const trendThresholds = getTrendThresholdSettings(settingsRepository);
  const reminderRules = getReminderRuleSettings(settingsRepository);
  const reminderStatus =
    reminderRules.ok && (reminderRules.data.inAppEnabled || reminderRules.data.emailEnabled) ? "已开启提醒" : "未开启提醒";
  const summary = createDashboardSummary({
    recordsRepository: createRecordsRepository(),
    goalsRepository: createGoalsRepository(),
    todayLocalDate: getTodayLocalDate(),
    heightCm: profile.ok ? profile.data.heightCm : null,
    estimationThresholds: trendThresholds.ok ? trendThresholds.data : undefined,
    reminderStatus,
  });
  return (
    <AppShell>
      <main className="page-main">
        <section className="mb-4 rounded-md border border-[var(--border-soft)] bg-[var(--surface-panel)] p-6">
          <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="m-0 inline-flex rounded-full bg-[var(--motion-soft)] px-3 py-1 text-sm font-semibold text-[var(--motion)]">
                跑步瘦身助手
              </p>
              <h1 className="m-0 mt-4 max-w-[1200px] text-[44px] font-bold leading-[1.08] tracking-normal text-[var(--ink-primary)] 2xl:text-[48px]">
                用每天一次跑步打卡，把体重和腰围往目标推
              </h1>
              <p className="mt-3 max-w-3xl text-base font-medium text-[var(--ink-secondary)]">
                先跑起来，再记录身体变化；首页直接告诉你今天做没做、还差多少、趋势是否靠近目标。
              </p>
            </div>
            <Button asChild className="min-h-12 px-5 text-base">
              <Link href="/records">
                <Zap aria-hidden="true" className="size-5" />
                开始今日打卡
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {summary.focusMetrics.map((metric) => (
              <FocusMetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        </section>

        <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-stretch">
          <TodayBattleCard battle={summary.todayBattle} />
          <AntiSlackingCard antiSlacking={summary.antiSlacking} />
        </div>

        <RunWeekCard runWeek={summary.runWeek} />

        <div className="mt-4">
          <GoalSettingsSection />
        </div>
      </main>
    </AppShell>
  );
}
