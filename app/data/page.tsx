import { AppShell } from "@/components/layout/app-shell";
import { StatusCard } from "@/features/dashboard/components/status-card";
import { TrendLineChart } from "@/features/dashboard/components/trend-line-chart";
import {
  createDashboardSummary,
  type DashboardProgressCard,
} from "@/features/dashboard/services/dashboard-summary";
import { requireTrustedDevice } from "@/features/access/services/route-guards";
import { createRecordsRepository } from "@/features/records/repositories/records-repository";
import { createGoalsRepository } from "@/features/goals/repositories/goals-repository";
import { createSettingsRepository } from "@/features/settings/repositories/settings-repository";
import { getProfileSettings } from "@/features/settings/services/profile-settings-service";
import { getReminderRuleSettings } from "@/features/settings/services/reminder-rule-settings-service";
import { getTrendThresholdSettings } from "@/features/settings/services/trend-threshold-settings-service";
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

export default async function DataPage() {
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
        <section className="mb-5 rounded-md border border-[#bfdbd9] bg-[#0f3d4a] p-6 text-white">
          <p className="m-0 inline-flex rounded-full bg-white/12 px-3 py-1 text-sm font-semibold text-[#b9f6e3]">
            数据导航
          </p>
          <h1 className="m-0 mt-4 text-[34px] font-semibold leading-tight text-white">
            看目标进度和长期变化
          </h1>
          <p className="m-0 mt-3 max-w-2xl text-sm text-[#d5e8ea]">
            这里集中展示健康、跑步和目标数据；首页只保留今天要完成的行动。
          </p>
        </section>

        <section aria-labelledby="data-summary" className="mb-5">
          <h2 id="data-summary" className="mb-3 text-lg font-semibold text-[var(--ink-primary)]">
            数据摘要
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {summary.metricCards.map((card) => (
              <StatusCard key={card.title} {...card} />
            ))}
          </div>
        </section>

        <section aria-labelledby="goal-progress" className="mb-5">
          <h2 id="goal-progress" className="mb-3 text-lg font-semibold text-[var(--ink-primary)]">
            目标进度
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {summary.progressCards.map((card) => (
              <article className="rounded-md border border-[#d5e4e6] bg-white p-5" key={card.title}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="m-0 text-base font-semibold text-[var(--ink-primary)]">{card.title}</h3>
                  <span className="rounded-full bg-[#eef7f7] px-3 py-1 text-xs font-semibold text-[#27606d]">
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
                    <p className="mt-4 text-sm text-[var(--ink-secondary)]">{card.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="data-curves">
          <h2 id="data-curves" className="mb-3 text-lg font-semibold text-[var(--ink-primary)]">
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
