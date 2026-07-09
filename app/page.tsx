import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, CalendarCheck, Flag, Route, Scale } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { GuestModeNotice } from "@/components/layout/guest-mode-notice";
import { LoginWelcomeToast } from "@/components/layout/login-welcome-toast";
import { OnboardingGuide } from "@/components/onboarding/onboarding-guide";
import { createDashboardSummary, type DashboardFocusMetric } from "@/features/dashboard/services/dashboard-summary";
import { requireAuthContext } from "@/features/access/services/route-guards";
import {
  createGoalsRepositoryForAuth,
  createRecordsRepositoryForAuth,
} from "@/features/access/services/scoped-repositories";
import { getTodayLocalDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

type CardTone = "health-goal" | "motion-goal" | "checkin" | "week" | "total";
type GoalCardState = "unset" | "pending" | "active" | "done";

type HomeProps = {
  searchParams?: Promise<{
    welcome?: string;
  }>;
};

function getSafeData<T>(result: { ok: true; data: T } | { ok: false }) {
  return result.ok ? result.data : null;
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function getGoalCardState(metric?: DashboardFocusMetric): GoalCardState {
  if (!metric || metric.status === "未设置") {
    return "unset";
  }

  if (metric.status === "已达成") {
    return "done";
  }

  if (metric.status === "待记录") {
    return "pending";
  }

  return "active";
}

function getHealthGoalCardState(metrics: DashboardFocusMetric[]): GoalCardState {
  const states = metrics.map((metric) => getGoalCardState(metric));

  if (states.every((state) => state === "unset")) {
    return "unset";
  }

  if (states.every((state) => state === "done")) {
    return "done";
  }

  if (states.some((state) => state === "pending")) {
    return "pending";
  }

  return "active";
}

function getRunGoalCardState(status: string): GoalCardState {
  if (status === "未设置") {
    return "unset";
  }

  if (status === "已完成") {
    return "done";
  }

  if (status === "待开始") {
    return "pending";
  }

  return "active";
}

function HomeCard({
  action,
  children,
  className = "",
  href,
  icon,
  label,
  tone,
  tourId,
}: {
  action: string;
  children: ReactNode;
  className?: string;
  href: string;
  icon: ReactNode;
  label: string;
  tone: CardTone;
  tourId?: string;
}) {
  return (
    <Link className={`home-card home-card--${tone} ${className}`} data-tour={tourId} href={href}>
      <div className="flex items-start justify-between gap-3">
        <span className="home-card__icon">{icon}</span>
        <span className="home-card__action">{action}</span>
      </div>
      <h2 className="m-0 mt-3 text-[22px] font-black leading-tight text-[var(--ink-primary)] max-sm:text-[20px]">
        {label}
      </h2>
      {children}
    </Link>
  );
}

function GoalMetricLine({
  label,
  state,
  value,
  unit,
}: {
  label: string;
  state: GoalCardState;
  value: string;
  unit: string;
}) {
  return (
    <div className={`home-goal-metric home-goal-metric--${state}`}>
      <span>{label}</span>
      <strong>
        {value}
        {unit ? <small>{unit}</small> : null}
      </strong>
    </div>
  );
}

function HealthGoalContent({ metrics }: { metrics: DashboardFocusMetric[] }) {
  const [weightMetric, measureMetric] = metrics;
  const state = getHealthGoalCardState(metrics);

  return (
    <div className="mt-4">
      <p className={`home-card__status home-card__status--${state}`}>
        {state === "unset" ? "待设置" : state === "done" ? "已达成" : state === "pending" ? "待记录" : "进行中"}
      </p>
      <div className="home-goal-metrics">
        <GoalMetricLine
          label="目标体重"
          state={getGoalCardState(weightMetric)}
          unit={weightMetric?.targetUnit ?? ""}
          value={weightMetric?.targetValue ?? "未设置"}
        />
        <GoalMetricLine
          label="目标腰围"
          state={getGoalCardState(measureMetric)}
          unit={measureMetric?.targetUnit ?? ""}
          value={measureMetric?.targetValue ?? "未设置"}
        />
      </div>
      <p className="m-0 mt-3 text-sm font-semibold text-[var(--ink-secondary)]">
        {state === "unset" ? "设置体重和腰围目标后，首页会显示差距。" : `${weightMetric?.gap ?? ""} · ${measureMetric?.gap ?? ""}`}
      </p>
    </div>
  );
}

function MotionGoalContent({
  completedCount,
  completedDistance,
  status,
  targetCount,
  targetDistance,
}: {
  completedCount: number;
  completedDistance: string;
  status: string;
  targetCount: number | null;
  targetDistance: string;
}) {
  const state = getRunGoalCardState(status);

  return (
    <div className="mt-4">
      <p className={`home-card__status home-card__status--${state}`}>
        {state === "unset" ? "待设置" : status}
      </p>
      <div className="home-goal-metrics">
        <GoalMetricLine
          label="每周次数"
          state={state}
          unit={targetCount == null ? "" : "次"}
          value={targetCount == null ? "未设置" : String(targetCount)}
        />
        <GoalMetricLine label="每周跑量" state={state} unit={targetDistance === "未设置" ? "" : "公里"} value={targetDistance} />
      </div>
      <p className="m-0 mt-3 text-sm font-semibold text-[var(--ink-secondary)]">
        本周已完成 {completedCount} 次 · {completedDistance} 公里
      </p>
    </div>
  );
}

export default async function Home({ searchParams }: HomeProps) {
  const auth = await requireAuthContext();
  const params = await searchParams;
  const welcomeName = auth.mode === "user" ? params?.welcome?.trim().slice(0, 32) ?? "" : "";

  const todayLocalDate = getTodayLocalDate();
  const recordsRepository = createRecordsRepositoryForAuth(auth);
  const goalsRepository = createGoalsRepositoryForAuth(auth);
  const summary = createDashboardSummary({
    recordsRepository,
    goalsRepository,
    todayLocalDate,
    includeAnalytics: false,
  });
  const allRuns = getSafeData(recordsRepository.listRunRecords()) ?? [];
  const totalRunDistance = allRuns.reduce((sum, record) => sum + record.distanceKm, 0);
  const weightMetric = summary.focusMetrics.find((metric) => metric.label === "目标体重");
  const measureMetric = summary.focusMetrics.find((metric) => metric.label === "目标腰围");
  const healthGoalMetrics = [weightMetric, measureMetric].filter((metric): metric is DashboardFocusMetric => Boolean(metric));
  const todayDone = summary.todayBattle.status === "已完成";
  const todayStarted = summary.todayBattle.status === "已开始";
  const todayCheckinState = todayDone ? "done" : todayStarted ? "started" : "missing";
  const runGoalUnset = summary.runWeek.status === "未设置";

  return (
    <AppShell authMode={auth.mode}>
      <main className="home-main">
        {welcomeName ? <LoginWelcomeToast name={welcomeName} /> : null}
        <OnboardingGuide />
        <div className="home-content">
          {auth.mode === "guest" ? (
            <GuestModeNotice>
              访客模式，数据仅在本次会话保留。
            </GuestModeNotice>
          ) : null}
          <section className="home-grid" aria-label="跑步瘦身首页入口">
            <HomeCard
              action={getHealthGoalCardState(healthGoalMetrics) === "unset" ? "设健康目标" : "调健康目标"}
              className={`home-card--health-goal home-card--goal-${getHealthGoalCardState(healthGoalMetrics)}`}
              href="/goals"
              icon={<Scale aria-hidden="true" className="size-5" />}
              label="健康目标"
              tone="health-goal"
              tourId="goal-health"
            >
              <HealthGoalContent metrics={healthGoalMetrics} />
            </HomeCard>

            <HomeCard
              action={runGoalUnset ? "设运动目标" : "调运动目标"}
              className={`home-card--motion-goal home-card--goal-${getRunGoalCardState(summary.runWeek.status)}`}
              href="/goals"
              icon={<Flag aria-hidden="true" className="size-5" />}
              label="运动目标"
              tone="motion-goal"
              tourId="goal-run"
            >
              <MotionGoalContent
                completedCount={summary.runWeek.completedCount}
                completedDistance={summary.runWeek.completedDistance}
                status={summary.runWeek.status}
                targetCount={summary.runWeek.targetCount}
                targetDistance={summary.runWeek.targetDistance}
              />
            </HomeCard>

            <HomeCard
              action="去打卡"
              className={`home-card--wide home-card--checkin-${todayCheckinState}`}
              href="/records"
              icon={<CalendarCheck aria-hidden="true" className="size-5" />}
              label="今日打卡"
              tone="checkin"
              tourId="today-checkin"
            >
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className={`today-checkin-status today-checkin-status--${todayCheckinState}`}>
                    {todayDone ? "已完成" : todayStarted ? "已开始" : "未完成"}
                  </p>
                  <p className="m-0 mt-3 text-sm font-semibold text-[var(--ink-secondary)]">{summary.todayBattle.text}</p>
                </div>
                <span className="today-checkin-action">
                  <Activity aria-hidden="true" className="size-4" />
                  {summary.todayBattle.primaryActionLabel}
                </span>
              </div>
            </HomeCard>

            <HomeCard
              action={runGoalUnset ? "设跑步目标" : "看分析"}
              href={runGoalUnset ? "/goals" : "/data"}
              icon={<Flag aria-hidden="true" className="size-5" />}
              label="本周跑量"
              tone="week"
              tourId="week-run"
            >
              <div className="mt-4">
                <div className="flex items-end gap-2">
                  <span className="home-card__value">
                    {summary.runWeek.completedDistance}
                  </span>
                  <span className="pb-1 text-sm font-bold text-[var(--ink-secondary)]">公里</span>
                </div>
                <p className="m-0 mt-3 text-sm font-semibold text-[var(--ink-secondary)]">
                  {summary.runWeek.completedCount} 次 · 目标 {summary.runWeek.targetDistance} 公里
                </p>
              </div>
            </HomeCard>

            <HomeCard
              action="看历史"
              href="/history"
              icon={<Route aria-hidden="true" className="size-5" />}
              label="累计跑量"
              tone="total"
              tourId="total-run"
            >
              <div className="mt-4">
                <div className="flex items-end gap-2">
                  <span className="home-card__value">
                    {formatNumber(totalRunDistance)}
                  </span>
                  <span className="pb-1 text-sm font-bold text-[var(--ink-secondary)]">公里</span>
                </div>
                <p className="m-0 mt-3 text-sm font-semibold text-[var(--ink-secondary)]">
                  共 {allRuns.length} 次跑步记录
                </p>
              </div>
            </HomeCard>
          </section>
        </div>

        <footer className="home-footer">
          <p className="m-0">
            Copyright © 2026 张治航
          </p>
          <p className="m-0 mt-2">
            经营性网站备案信息：
            <a href="https://beian.miit.gov.cn/" rel="noreferrer" target="_blank">
              苏ICP备2026044129号
            </a>
          </p>
          <p className="m-0 mt-2">本网站暂未申请公安机关互联网安全备案。</p>
        </footer>
      </main>
    </AppShell>
  );
}



