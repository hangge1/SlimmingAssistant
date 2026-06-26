import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/features/dashboard/components/status-card";
import { TrendLineChart } from "@/features/dashboard/components/trend-line-chart";
import { createDashboardSummary, type DashboardProgressCard } from "@/features/dashboard/services/dashboard-summary";
import { requireTrustedDevice } from "@/features/access/services/route-guards";
import { createRecordsRepository } from "@/features/records/repositories/records-repository";
import { createGoalsRepository } from "@/features/goals/repositories/goals-repository";
import { createSettingsRepository } from "@/features/settings/repositories/settings-repository";
import { getProfileSettings } from "@/features/settings/services/profile-settings-service";
import { getTrendThresholdSettings } from "@/features/settings/services/trend-threshold-settings-service";
import { getReminderRuleSettings } from "@/features/settings/services/reminder-rule-settings-service";
import { getTodayLocalDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

function goalProgressColor(title: string) {
  return title.includes("跑步") ? "var(--motion)" : "var(--health)";
}

function GoalProgressChart({ card }: { card: DashboardProgressCard }) {
  const percent = Math.max(0, Math.min(100, card.progressPercent));
  const color = goalProgressColor(card.title);

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <svg
        aria-label={`${card.title} ${percent}%`}
        className="h-40 w-40"
        role="img"
        viewBox="0 0 120 120"
      >
        <circle
          cx="60"
          cy="60"
          fill="none"
          r="46"
          stroke="var(--surface-subtle)"
          strokeWidth="16"
        />
        <circle
          cx="60"
          cy="60"
          fill="none"
          pathLength="100"
          r="46"
          stroke={color}
          strokeDasharray={`${percent} ${100 - percent}`}
          strokeLinecap="round"
          strokeWidth="16"
          transform="rotate(-90 60 60)"
        />
        <text
          fill="var(--ink-primary)"
          fontSize="26"
          fontWeight="700"
          textAnchor="middle"
          x="60"
          y="58"
        >
          {percent}%
        </text>
        <text fill="var(--ink-muted)" fontSize="12" textAnchor="middle" x="60" y="76">
          完成度
        </text>
      </svg>
      <span className="text-center text-sm font-semibold text-[var(--ink-primary)]">{card.gap}</span>
    </div>
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
  const healthStatus = summary.statusItems.find((item) => item.label === "身体数据")?.value;
  const runStatus = summary.statusItems.find((item) => item.label === "跑步记录")?.value;
  const hasHealthRecord = healthStatus === "已记录";
  const hasRunRecord = runStatus?.startsWith("已记录") ?? false;
  const todayStatusLabel = hasHealthRecord && hasRunRecord ? "已完成" : hasHealthRecord || hasRunRecord ? "已开始" : "待开始";

  return (
    <AppShell>
      <main className="page-main">
        <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="grid gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="m-0 text-[32px] font-semibold leading-tight tracking-normal text-[var(--ink-primary)]">
                  瘦身助手
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-[var(--ink-secondary)]">
                  今天先完成记录，再看趋势和目标差距。
                </p>
              </div>
              <Button asChild>
                <Link href="/records">记录今天</Link>
              </Button>
            </div>

            <section aria-labelledby="today-feedback" className="card p-4">
              <p className="mb-1 text-sm font-semibold text-[var(--ink-secondary)]">今日反馈</p>
              <h2 id="today-feedback" className="m-0 text-base font-semibold text-[var(--ink-primary)]">
                {summary.encouragement.title}
              </h2>
              <p className="m-0 mt-2 text-sm text-[var(--ink-secondary)]">{summary.encouragement.text}</p>
            </section>
          </div>

          <section aria-labelledby="today-status" className="card p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id="today-status" className="m-0 text-base font-semibold">
                今日状态
              </h2>
              <span className="rounded-full bg-[var(--warning-soft)] px-3 py-1 text-xs font-semibold text-[#92400e]">
                {todayStatusLabel}
              </span>
            </div>
            <div className="grid gap-1">
              {summary.statusItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex min-h-10 items-center justify-between border-b border-[var(--border-soft)] py-2 last:border-b-0"
                  aria-label={`${item.label}：${item.value}`}
                >
                  <span className="text-[var(--ink-secondary)]">{item.label}</span>
                  <span className="font-semibold text-[var(--ink-primary)]">{item.value}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <section aria-labelledby="goal-progress" className="mb-4">
          <h2 id="goal-progress" className="mb-3 text-lg font-semibold text-[var(--ink-primary)]">
            目标进度
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {summary.progressCards.map((card) => (
              <article className="card p-5" key={card.title}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="m-0 text-base font-semibold text-[var(--ink-primary)]">{card.title}</h3>
                  <span className="rounded-full bg-[var(--warning-soft)] px-3 py-1 text-xs font-semibold text-[#92400e]">
                    {card.status}
                  </span>
                </div>
                <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                  <GoalProgressChart card={card} />
                  <div>
                    <div className="grid gap-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--ink-secondary)]">当前值</span>
                        <span className="text-base font-semibold text-[var(--ink-primary)]">{card.currentValue}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--ink-secondary)]">目标值</span>
                        <span className="text-base font-semibold text-[var(--ink-primary)]">{card.targetValue}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--ink-secondary)]">剩余差距</span>
                        <span className="text-base font-semibold text-[var(--ink-primary)]">{card.gap}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--ink-secondary)]">预计达成</span>
                        <span className="text-base font-semibold text-[var(--ink-primary)]">{card.estimate}</span>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-[var(--ink-secondary)]">
                      {card.description}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-label="首页摘要"
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {summary.metricCards.map((card) => (
            <StatusCard key={card.title} {...card} />
          ))}
        </section>

        <section aria-labelledby="data-curves" className="mt-4">
          <h2 id="data-curves" className="mb-3 text-base font-semibold text-[var(--ink-primary)]">
            数据曲线
          </h2>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {summary.chartPanels.map((panel) => (
              <TrendLineChart key={panel.title} panel={panel} />
            ))}
          </div>
        </section>

      </main>
    </AppShell>
  );
}
