import type { createGoalsRepository } from "@/features/goals/repositories/goals-repository";
import type { createRecordsRepository } from "@/features/records/repositories/records-repository";

type RecordsRepository = Pick<
  ReturnType<typeof createRecordsRepository>,
  "getHealthRecordByDate" | "listHealthRecords" | "listRunRecordsByDate" | "listRunRecords"
>;
type GoalsRepository = Pick<ReturnType<typeof createGoalsRepository>, "getGoalByType">;

type DashboardSummaryInput = {
  recordsRepository: RecordsRepository;
  goalsRepository: GoalsRepository;
  todayLocalDate: string;
  heightCm?: number | null;
  estimationThresholds?: {
    minimumDays: number;
    minimumRecords: number;
  };
  reminderStatus?: string;
};

export type DashboardStatusItem = {
  label: string;
  value: string;
  href: string;
};

export type DashboardMetricCard = {
  title: string;
  value: string;
  unit: string;
  description: string;
  tone: "health" | "motion" | "warning";
};

export type DashboardProgressCard = {
  title: string;
  status: "未设置" | "进行中" | "已达成" | "落后";
  currentValue: string;
  targetValue: string;
  gap: string;
  estimate: string;
  progressPercent: number;
  description: string;
};

export type DashboardEncouragement = {
  title: string;
  text: string;
};

export type DashboardFocusMetric = {
  label: string;
  targetValue: string;
  targetUnit: string;
  currentValue: string;
  currentUnit: string;
  gap: string;
  dailyChange: string;
  projectedDays: string;
  status: "未设置" | "待记录" | "进行中" | "已达成";
  tone: "health" | "warning";
  href: string;
};

export type DashboardTodayBattle = {
  status: "待开始" | "已开始" | "已完成";
  title: string;
  text: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  items: Array<{
    label: string;
    value: string;
    done: boolean;
    href: string;
  }>;
};

export type DashboardRunWeek = {
  status: "未设置" | "待开始" | "进行中" | "已完成";
  completedCount: number;
  targetCount: number | null;
  remainingCount: number | null;
  completedDistance: string;
  targetDistance: string;
  remainingDistance: string;
  text: string;
  href: string;
};

export type DashboardAntiSlacking = {
  title: string;
  text: string;
  actionLabel: string;
  href: string;
  tone: "warning" | "health" | "motion";
};

export type DashboardChartPoint = {
  localDate: string;
  value: number;
};

export type DashboardChartMetric = {
  label: string;
  unit: string;
  value: string;
  change: string;
  tone: "health" | "motion" | "warning";
  points: DashboardChartPoint[];
};

export type DashboardChartPeriodOption = {
  label: string;
  days: number;
  startLocalDate: string;
  endLocalDate: string;
  metrics: DashboardChartMetric[];
};

export type DashboardChartPanel = {
  title: string;
  description: string;
  periodOptions: DashboardChartPeriodOption[];
};

function formatNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatSignedNumber(value: number) {
  const formatted = formatNumber(value);
  return value > 0 ? `+${formatted}` : formatted;
}

function parseLocalDate(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatLocalDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(localDate: string, days: number) {
  const date = new Date(parseLocalDate(localDate));
  date.setUTCDate(date.getUTCDate() + days);
  return formatLocalDate(date);
}

function filterByRecentDays<T extends { localDate: string }>(records: T[], todayLocalDate: string, days: number) {
  const today = parseLocalDate(todayLocalDate);
  const start = today - (days - 1) * 24 * 60 * 60 * 1000;

  return records
    .filter((record) => {
      const time = parseLocalDate(record.localDate);
      return time >= start && time <= today;
    })
    .sort((a, b) => parseLocalDate(a.localDate) - parseLocalDate(b.localDate));
}

function daysBetween(startLocalDate: string, endLocalDate: string) {
  return Math.max(0, (parseLocalDate(endLocalDate) - parseLocalDate(startLocalDate)) / (24 * 60 * 60 * 1000));
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDays(days: number) {
  return `约 ${Math.max(1, Math.ceil(days))} 天`;
}

function formatDelta(value: number, unit: string) {
  const formatted = formatSignedNumber(value);
  return `${formatted}${unit}`;
}

function buildProjectedDays(remaining: number, dailyChange: number | null) {
  if (remaining <= 0) {
    return "已达到目标";
  }

  if (dailyChange == null) {
    return "数据不足";
  }

  if (dailyChange >= 0) {
    return "趋势未靠近";
  }

  return formatDays(remaining / Math.abs(dailyChange));
}

function getErrorSafeData<T>(result: { ok: true; data: T } | { ok: false }) {
  return result.ok ? result.data : null;
}

function getRecentDateLabels(todayLocalDate: string, days: number) {
  return Array.from({ length: days }, (_, index) => addDays(todayLocalDate, index - days + 1));
}

function buildMetricChange(points: DashboardChartPoint[], unit: string) {
  if (points.length < 2) {
    return "数据不足";
  }

  const first = points[0];
  const latest = points[points.length - 1];
  const change = latest.value - first.value;
  const suffix = unit ? ` ${unit}` : "";

  if (change === 0) {
    return "持平";
  }

  return `变化 ${formatSignedNumber(change)}${suffix}`;
}

function buildVisualMetric(
  label: string,
  unit: string,
  points: DashboardChartPoint[],
  tone: DashboardChartMetric["tone"],
): DashboardChartMetric {
  const latest = points[points.length - 1];

  return {
    label,
    unit,
    value: latest ? formatNumber(latest.value) : "暂无",
    change: buildMetricChange(points, unit),
    tone,
    points,
  };
}

function countConsecutiveMissingRunDays(allRuns: Array<{ localDate: string }>, todayLocalDate: string) {
  const runDates = new Set(allRuns.map((record) => record.localDate));
  let missingDays = 0;

  for (let offset = 0; offset < 14; offset += 1) {
    const localDate = addDays(todayLocalDate, -offset);

    if (runDates.has(localDate)) {
      break;
    }

    missingDays += 1;
  }

  return missingDays;
}

export function createDashboardSummary({
  recordsRepository,
  goalsRepository,
  todayLocalDate,
  heightCm = null,
  estimationThresholds = { minimumDays: 7, minimumRecords: 3 },
  reminderStatus = "未开启提醒",
}: DashboardSummaryInput) {
  const todayHealth = getErrorSafeData(recordsRepository.getHealthRecordByDate(todayLocalDate));
  const latestHealthRecords = getErrorSafeData(recordsRepository.listHealthRecords()) ?? [];
  const todayRuns = getErrorSafeData(recordsRepository.listRunRecordsByDate(todayLocalDate)) ?? [];
  const allRuns = getErrorSafeData(recordsRepository.listRunRecords()) ?? [];
  const healthGoal = getErrorSafeData(goalsRepository.getGoalByType("health"));
  const runGoal = getErrorSafeData(goalsRepository.getGoalByType("run"));
  const latestHealth = todayHealth ?? latestHealthRecords[0] ?? null;
  const todayRunDistance = todayRuns.reduce((sum, record) => sum + record.distanceKm, 0);
  const hasAnyGoal = healthGoal != null || runGoal != null;
  const healthRecordsByDateAsc = [...latestHealthRecords].sort(
    (a, b) => parseLocalDate(a.localDate) - parseLocalDate(b.localDate),
  );

  const buildHealthFocusMetric = (
    label: string,
    target: number | null | undefined,
    unit: string,
    getValue: (record: (typeof latestHealthRecords)[number]) => number | null,
    tone: DashboardFocusMetric["tone"],
  ): DashboardFocusMetric => {
    if (target == null) {
      return {
        label,
        targetValue: "未设置",
        targetUnit: unit,
        currentValue: "暂无",
        currentUnit: unit,
        gap: "请先设置目标",
        dailyChange: "暂无变化",
        projectedDays: "无法估算",
        status: "未设置",
        tone,
        href: "/#goal-settings",
      };
    }

    const validRecords = healthRecordsByDateAsc
      .map((record) => ({
        localDate: record.localDate,
        value: getValue(record),
      }))
      .filter((record): record is { localDate: string; value: number } => record.value != null);
    const latest = validRecords[validRecords.length - 1];
    const previous = validRecords[validRecords.length - 2];

    if (!latest) {
      return {
        label,
        targetValue: formatNumber(target),
        targetUnit: unit,
        currentValue: "暂无",
        currentUnit: unit,
        gap: "需要先记录当前值",
        dailyChange: "暂无变化",
        projectedDays: "无法估算",
        status: "待记录",
        tone,
        href: "/records",
      };
    }

    const remaining = latest.value - target;
    const days = previous ? Math.max(1, daysBetween(previous.localDate, latest.localDate)) : 0;
    const dailyChange = previous ? (latest.value - previous.value) / days : null;

    return {
      label,
      targetValue: formatNumber(target),
      targetUnit: unit,
      currentValue: formatNumber(latest.value),
      currentUnit: unit,
      gap: remaining <= 0 ? "已达到目标" : `还差 ${formatNumber(remaining)}${unit}`,
      dailyChange: dailyChange == null ? "暂无变化" : `日均 ${formatDelta(dailyChange, unit)}`,
      projectedDays: buildProjectedDays(remaining, dailyChange),
      status: remaining <= 0 ? "已达成" : "进行中",
      tone,
      href: "/records",
    };
  };

  const focusMetrics: DashboardFocusMetric[] = [
    buildHealthFocusMetric("目标体重", healthGoal?.targetWeightKg, "公斤", (record) => record.weightKg, "health"),
    buildHealthFocusMetric("目标腰围", healthGoal?.targetWaistCm, "厘米", (record) => record.waistCm, "warning"),
  ];
  const hasTodayHealth = todayHealth != null;
  const hasTodayRun = todayRuns.length > 0;
  const todayBattle: DashboardTodayBattle = {
    status: hasTodayHealth && hasTodayRun ? "已完成" : hasTodayHealth || hasTodayRun ? "已开始" : "待开始",
    title: hasTodayHealth && hasTodayRun ? "今日打卡闭环已完成" : hasTodayRun ? "跑步已打卡，补齐健康打卡" : "今天还没跑步打卡",
    text:
      hasTodayHealth && hasTodayRun
        ? "今天的跑步和健康数据都已记录，首页目标差距会使用最新数据。"
        : hasTodayRun
          ? "跑步打卡已经完成，再补一条健康打卡，才能判断体重和腰围是否靠近目标。"
          : "先完成一次跑步打卡，再补健康打卡，让今天进入减肥循环。",
    primaryActionLabel: hasTodayHealth && hasTodayRun ? "查看历史证据" : hasTodayRun ? "补健康打卡" : "去跑步打卡",
    primaryActionHref: hasTodayHealth && hasTodayRun ? "/history" : "/records",
    items: [
      {
        label: "跑步打卡",
        value: hasTodayRun ? `已记录 ${todayRuns.length} 次` : "未完成",
        done: hasTodayRun,
        href: "/records",
      },
      {
        label: "健康打卡",
        value: hasTodayHealth ? "已记录" : "未记录",
        done: hasTodayHealth,
        href: "/records",
      },
      {
        label: "目标反馈",
        value: hasTodayHealth || latestHealth ? "可查看" : "待数据",
        done: hasTodayHealth || latestHealth != null,
        href: "/data",
      },
    ],
  };

  const statusItems: DashboardStatusItem[] = [
    {
      label: "健康打卡",
      value: todayHealth ? "已记录" : "待记录",
      href: "/records",
    },
    {
      label: "跑步打卡",
      value: todayRuns.length > 0 ? `已记录 ${todayRuns.length} 次` : "待添加",
      href: "/records",
    },
    {
      label: "提醒状态",
      value: reminderStatus,
      href: "/settings",
    },
    {
      label: "目标设置",
      value: hasAnyGoal ? "已设置" : "待设置",
      href: "/#goal-settings",
    },
  ];

  const healthValue = latestHealth?.weightKg == null ? "暂无数据" : formatNumber(latestHealth.weightKg);
  const healthUnit = latestHealth?.weightKg == null ? "" : "公斤";
  const latestBmi =
    heightCm && heightCm > 0 && latestHealth?.weightKg != null
      ? latestHealth.weightKg / ((heightCm / 100) * (heightCm / 100))
      : null;
  const healthDescription = latestHealth
    ? `最近记录：${latestHealth.localDate}${latestBmi == null ? "" : `，BMI ${formatNumber(latestBmi)}`}，继续补齐围度和体脂率可以让摘要更完整。`
    : "记录体重、围度和体脂率后显示健康摘要。";

  const motionValue = todayRuns.length > 0 ? formatNumber(todayRunDistance) : "暂无跑量";
  const motionUnit = todayRuns.length > 0 ? "公里" : "";
  const motionDescription =
    todayRuns.length > 0
      ? `今天已记录 ${todayRuns.length} 次跑步。`
      : "添加跑步记录后显示今天跑量和次数。";

  const recentGoalRuns = filterByRecentDays(allRuns, todayLocalDate, 7);
  const recentGoalRunCount = recentGoalRuns.length;
  const recentGoalRunDistance = recentGoalRuns.reduce((sum, record) => sum + record.distanceKm, 0);
  const runWeek: DashboardRunWeek = {
    status:
      runGoal?.weeklyRunCount == null || runGoal.weeklyDistanceKm == null
        ? "未设置"
        : recentGoalRunCount === 0 && recentGoalRunDistance === 0
          ? "待开始"
          : recentGoalRunCount >= runGoal.weeklyRunCount && recentGoalRunDistance >= runGoal.weeklyDistanceKm
            ? "已完成"
            : "进行中",
    completedCount: recentGoalRunCount,
    targetCount: runGoal?.weeklyRunCount ?? null,
    remainingCount: runGoal?.weeklyRunCount == null ? null : Math.max(0, runGoal.weeklyRunCount - recentGoalRunCount),
    completedDistance: formatNumber(recentGoalRunDistance),
    targetDistance: runGoal?.weeklyDistanceKm == null ? "未设置" : formatNumber(runGoal.weeklyDistanceKm),
    remainingDistance:
      runGoal?.weeklyDistanceKm == null ? "未设置" : formatNumber(Math.max(0, runGoal.weeklyDistanceKm - recentGoalRunDistance)),
    text:
      runGoal?.weeklyRunCount == null || runGoal.weeklyDistanceKm == null
        ? "先设置每周跑步次数和跑量，首页才能催促你完成本周行动。"
        : `最近 7 天已跑 ${recentGoalRunCount} 次 / ${formatNumber(recentGoalRunDistance)} 公里。`,
    href: runGoal?.weeklyRunCount == null || runGoal.weeklyDistanceKm == null ? "/#goal-settings" : "/records",
  };
  const missingRunDays = countConsecutiveMissingRunDays(allRuns, todayLocalDate);
  const antiSlacking: DashboardAntiSlacking = hasTodayRun
    ? hasTodayHealth
      ? {
          title: "今天的行动已经留下证据",
          text: "跑步和健康打卡都已记录。明天继续重复这个闭环，趋势才会越来越可信。",
          actionLabel: "查看历史证据",
          href: "/history",
          tone: "health",
        }
      : {
          title: "别让今天的跑步缺少反馈",
          text: "你已经跑了，补上体重和腰围，才能知道这次行动是否正在把你推向目标。",
          actionLabel: "补健康打卡",
          href: "/records",
          tone: "motion",
        }
    : {
        title: missingRunDays >= 2 ? `已经 ${missingRunDays} 天没有跑步打卡` : "今天还没有跑步打卡",
        text:
          missingRunDays >= 2
            ? "目标不会因为计划存在而靠近。今天先恢复一次，不需要完美，只需要重新开始。"
            : "你不是缺计划，是缺今天这一次行动。先完成一次跑步，数据会替你证明没有白做。",
        actionLabel: "完成跑步打卡",
        href: "/records",
        tone: "warning",
      };
  const healthGoalSummary =
    healthGoal?.targetWeightKg == null
      ? null
      : latestHealth?.weightKg == null
        ? {
            value: "待记录",
            unit: "",
            description: `健康目标：目标 ${formatNumber(healthGoal.targetWeightKg)} 公斤，需要先记录体重。`,
          }
        : latestHealth.weightKg <= healthGoal.targetWeightKg
          ? {
              value: "健康已达成",
              unit: "",
              description: `健康目标：当前 ${formatNumber(latestHealth.weightKg)} 公斤，目标 ${formatNumber(healthGoal.targetWeightKg)} 公斤。`,
            }
          : {
              value: `还差 ${formatNumber(latestHealth.weightKg - healthGoal.targetWeightKg)}`,
              unit: "公斤",
              description: `健康目标：当前 ${formatNumber(latestHealth.weightKg)} 公斤，目标 ${formatNumber(healthGoal.targetWeightKg)} 公斤。`,
            };
  const runRemainingCount = runGoal?.weeklyRunCount == null ? 0 : Math.max(0, runGoal.weeklyRunCount - recentGoalRunCount);
  const runRemainingDistance =
    runGoal?.weeklyDistanceKm == null ? 0 : Math.max(0, runGoal.weeklyDistanceKm - recentGoalRunDistance);
  const runGoalSummary =
    runGoal?.weeklyRunCount == null || runGoal.weeklyDistanceKm == null
      ? null
      : {
          value:
            runRemainingCount === 0 && runRemainingDistance === 0
              ? "跑步已达成"
              : runRemainingCount > 0
                ? `还差 ${runRemainingCount}`
                : `还差 ${formatNumber(runRemainingDistance)}`,
          unit: runRemainingCount === 0 && runRemainingDistance === 0 ? "" : runRemainingCount > 0 ? "次" : "公里",
          description: `跑步目标：最近 7 天还差 ${runRemainingCount} 次 / ${formatNumber(runRemainingDistance)} 公里。`,
        };
  const targetValue =
    healthGoalSummary?.value ?? runGoalSummary?.value ?? "未设置";
  const targetUnit = healthGoalSummary?.unit ?? runGoalSummary?.unit ?? "";
  const targetDescription = hasAnyGoal
    ? [healthGoalSummary?.description, runGoalSummary?.description].filter(Boolean).join(" ")
    : "设置健康目标和跑步目标后显示目标摘要。";

  const metricCards: DashboardMetricCard[] = [
    {
      title: "健康摘要",
      value: healthValue,
      unit: healthUnit,
      description: healthDescription,
      tone: "health",
    },
    {
      title: "运动摘要",
      value: motionValue,
      unit: motionUnit,
      description: motionDescription,
      tone: "motion",
    },
    {
      title: "目标摘要",
      value: targetValue,
      unit: targetUnit,
      description: targetDescription,
      tone: "warning",
    },
  ];

  const chartRangeOptions = [
    { label: "最近 7 天", days: 7 },
    { label: "最近 30 天", days: 30 },
    { label: "最近半年", days: 183 },
    { label: "最近 1 年", days: 365 },
  ].map((range) => ({
    ...range,
    startLocalDate: addDays(todayLocalDate, 1 - range.days),
    endLocalDate: todayLocalDate,
  }));

  const buildHealthChartMetrics = (days: number): DashboardChartMetric[] => {
    const periodHealthRecords = filterByRecentDays(latestHealthRecords, todayLocalDate, days);
    const metrics: DashboardChartMetric[] = [
      buildVisualMetric(
        "体重",
        "公斤",
        periodHealthRecords
          .filter((record) => record.weightKg != null)
          .map((record) => ({ localDate: record.localDate, value: record.weightKg ?? 0 })),
        "health",
      ),
      buildVisualMetric(
        "腰围",
        "厘米",
        periodHealthRecords
          .filter((record) => record.waistCm != null)
          .map((record) => ({ localDate: record.localDate, value: record.waistCm ?? 0 })),
        "health",
      ),
      buildVisualMetric(
        "体脂率",
        "%",
        periodHealthRecords
          .filter((record) => record.bodyFatPercentage != null)
          .map((record) => ({ localDate: record.localDate, value: record.bodyFatPercentage ?? 0 })),
        "warning",
      ),
    ];

    if (heightCm && heightCm > 0) {
      const heightMeters = heightCm / 100;
      metrics.push(
        buildVisualMetric(
          "BMI",
          "",
          periodHealthRecords
            .filter((record) => record.weightKg != null)
            .map((record) => ({
              localDate: record.localDate,
              value: (record.weightKg ?? 0) / (heightMeters * heightMeters),
            })),
          "warning",
        ),
      );
    } else {
      metrics.push({
        label: "BMI",
        unit: "",
        value: "待设置身高",
        change: "设置身高后显示 BMI",
        tone: "warning",
        points: [],
      });
    }

    return metrics;
  };

  const buildRunChartMetrics = (days: number): DashboardChartMetric[] => {
    const periodDateLabels = getRecentDateLabels(todayLocalDate, days);
    const periodRuns = filterByRecentDays(allRuns, todayLocalDate, days);
    const periodRunsByDate = new Map<
      string,
      {
        distanceKm: number;
        count: number;
        paceSecondsTotal: number;
        paceRecordCount: number;
        heartRateTotal: number;
        heartRateRecordCount: number;
      }
    >();

    for (const localDate of periodDateLabels) {
      periodRunsByDate.set(localDate, {
        distanceKm: 0,
        count: 0,
        paceSecondsTotal: 0,
        paceRecordCount: 0,
        heartRateTotal: 0,
        heartRateRecordCount: 0,
      });
    }

    for (const run of periodRuns) {
      const day = periodRunsByDate.get(run.localDate);
      if (!day) {
        continue;
      }

      day.distanceKm += run.distanceKm;
      day.count += 1;

      if (run.paceSecondsPerKm != null) {
        day.paceSecondsTotal += run.paceSecondsPerKm;
        day.paceRecordCount += 1;
      }

      if (run.averageHeartRateBpm != null) {
        day.heartRateTotal += run.averageHeartRateBpm;
        day.heartRateRecordCount += 1;
      }
    }

    return [
      buildVisualMetric(
        "每日跑量",
        "公里",
        periodDateLabels.map((localDate) => ({
          localDate,
          value: periodRunsByDate.get(localDate)?.distanceKm ?? 0,
        })),
        "motion",
      ),
      buildVisualMetric(
        "跑步次数",
        "次",
        periodDateLabels.map((localDate) => ({
          localDate,
          value: periodRunsByDate.get(localDate)?.count ?? 0,
        })),
        "motion",
      ),
      buildVisualMetric(
        "平均配速",
        "分钟/公里",
        periodDateLabels
          .map((localDate) => {
            const day = periodRunsByDate.get(localDate);
            return day && day.paceRecordCount > 0
              ? { localDate, value: day.paceSecondsTotal / day.paceRecordCount / 60 }
              : null;
          })
          .filter((point): point is DashboardChartPoint => point != null),
        "warning",
      ),
      buildVisualMetric(
        "平均心率",
        "次/分",
        periodDateLabels
          .map((localDate) => {
            const day = periodRunsByDate.get(localDate);
            return day && day.heartRateRecordCount > 0
              ? { localDate, value: day.heartRateTotal / day.heartRateRecordCount }
              : null;
          })
          .filter((point): point is DashboardChartPoint => point != null),
        "warning",
      ),
    ];
  };

  const chartPanels: DashboardChartPanel[] = [
    {
      title: "健康曲线",
      description: "每个指标独立缩放，重点观察方向和波动。",
      periodOptions: chartRangeOptions.map((range) => ({
        ...range,
        metrics: buildHealthChartMetrics(range.days),
      })),
    },
    {
      title: "运动曲线",
      description: "跑量和次数按自然日展示，配速和心率按有记录的日期展示。",
      periodOptions: chartRangeOptions.map((range) => ({
        ...range,
        metrics: buildRunChartMetrics(range.days),
      })),
    },
  ];

  const buildUnsetProgressCard = (title: string): DashboardProgressCard => ({
    title,
    status: "未设置",
    currentValue: "暂无",
    targetValue: "未设置",
    gap: "请先设置目标",
    estimate: "无法可靠估算：目标未设置。",
    progressPercent: 0,
    description: "设置目标后会显示当前值、目标值和剩余差距。",
  });

  const buildHealthProgressCard = (): DashboardProgressCard => {
    if (healthGoal?.targetWeightKg == null) {
      return buildUnsetProgressCard("健康目标进度");
    }

    if (latestHealth?.weightKg == null) {
      return {
        title: "健康目标进度",
        status: "进行中",
        currentValue: "暂无记录",
        targetValue: `${formatNumber(healthGoal.targetWeightKg)} 公斤`,
        gap: "需要先记录体重",
        estimate: "无法可靠估算：数据不足。",
        progressPercent: 0,
        description: "至少需要体重记录才能计算健康目标差距。",
      };
    }

    const remainingKg = latestHealth.weightKg - healthGoal.targetWeightKg;

    if (remainingKg <= 0) {
      return {
        title: "健康目标进度",
        status: "已达成",
        currentValue: `${formatNumber(latestHealth.weightKg)} 公斤`,
        targetValue: `${formatNumber(healthGoal.targetWeightKg)} 公斤`,
        gap: "已达到目标",
        estimate: "已达成当前健康目标。",
        progressPercent: 100,
        description: "当前体重已经达到目标体重。",
      };
    }

    const validRecords = latestHealthRecords
      .filter((record) => record.weightKg != null)
      .sort((a, b) => parseLocalDate(a.localDate) - parseLocalDate(b.localDate));
    const earliest = validRecords[0];
    const latest = validRecords[validRecords.length - 1];
    let estimate = "无法可靠估算：数据不足。";
    let status: DashboardProgressCard["status"] = "进行中";

    if (
      validRecords.length >= estimationThresholds.minimumRecords &&
      earliest &&
      latest &&
      daysBetween(earliest.localDate, latest.localDate) >= estimationThresholds.minimumDays
    ) {
      const spanDays = daysBetween(earliest.localDate, latest.localDate);
      const dailyChange = ((latest.weightKg ?? 0) - (earliest.weightKg ?? 0)) / spanDays;

      if (dailyChange < 0) {
        estimate = formatDays((healthGoal.targetWeightKg - latestHealth.weightKg) / dailyChange);
      } else {
        estimate = "无法可靠估算：当前趋势没有靠近目标。";
        status = "落后";
      }
    }

    return {
      title: "健康目标进度",
      status,
      currentValue: `${formatNumber(latestHealth.weightKg)} 公斤`,
      targetValue: `${formatNumber(healthGoal.targetWeightKg)} 公斤`,
      gap: `还差 ${formatNumber(remainingKg)} 公斤`,
      estimate,
      progressPercent: clampPercent((healthGoal.targetWeightKg / latestHealth.weightKg) * 100),
      description: "基于最新体重和最近有效记录估算。",
    };
  };

  const buildRunProgressCard = (): DashboardProgressCard => {
    if (runGoal?.weeklyRunCount == null || runGoal.weeklyDistanceKm == null) {
      return buildUnsetProgressCard("跑步目标进度");
    }

    const recentRuns = filterByRecentDays(allRuns, todayLocalDate, 7);
    const currentCount = recentRuns.length;
    const currentDistance = recentRuns.reduce((sum, record) => sum + record.distanceKm, 0);
    const remainingCount = Math.max(0, runGoal.weeklyRunCount - currentCount);
    const remainingDistance = Math.max(0, runGoal.weeklyDistanceKm - currentDistance);
    const achieved = remainingCount === 0 && remainingDistance === 0;

    if (achieved) {
      return {
        title: "跑步目标进度",
        status: "已达成",
        currentValue: `${currentCount} 次 / ${formatNumber(currentDistance)} 公里`,
        targetValue: `${runGoal.weeklyRunCount} 次 / ${formatNumber(runGoal.weeklyDistanceKm)} 公里`,
        gap: "已达到目标",
        estimate: "已达成本周跑步目标。",
        progressPercent: 100,
        description: "最近 7 天跑步次数和跑量均已达到目标。",
      };
    }

    let estimate = "无法可靠估算：数据不足。";
    const status: DashboardProgressCard["status"] = recentRuns.length === 0 ? "落后" : "进行中";

    if (recentRuns.length >= estimationThresholds.minimumRecords) {
      const countPerDay = currentCount / 7;
      const distancePerDay = currentDistance / 7;
      const countDays = remainingCount > 0 && countPerDay > 0 ? remainingCount / countPerDay : 0;
      const distanceDays = remainingDistance > 0 && distancePerDay > 0 ? remainingDistance / distancePerDay : 0;
      const estimatedDays = Math.max(countDays, distanceDays);

      if (estimatedDays > 0) {
        estimate = formatDays(estimatedDays);
      }
    }

    return {
      title: "跑步目标进度",
      status,
      currentValue: `${currentCount} 次 / ${formatNumber(currentDistance)} 公里`,
      targetValue: `${runGoal.weeklyRunCount} 次 / ${formatNumber(runGoal.weeklyDistanceKm)} 公里`,
      gap: `还差 ${remainingCount} 次 / ${formatNumber(remainingDistance)} 公里`,
      estimate,
      progressPercent: clampPercent(
        Math.min(currentCount / runGoal.weeklyRunCount, currentDistance / runGoal.weeklyDistanceKm) * 100,
      ),
      description: "基于最近 7 天跑步记录估算。",
    };
  };

  const progressCards: DashboardProgressCard[] = [buildHealthProgressCard(), buildRunProgressCard()];

  const buildEncouragement = (): DashboardEncouragement => {
    const [healthProgress, runProgress] = progressCards;
    const hasAnyRecord = todayHealth != null || todayRuns.length > 0 || latestHealthRecords.length > 0 || allRuns.length > 0;

    if (healthProgress.status === "已达成") {
      return {
        title: "目标达成",
        text: "已经达到健康目标，接下来可以保持记录节奏，观察几天的稳定情况。",
      };
    }

    if (runProgress.status === "已达成") {
      return {
        title: "目标达成",
        text: "本周跑步目标已经完成，后面可以按身体感受安排轻松记录。",
      };
    }

    if (healthProgress.status === "落后" || runProgress.status === "落后") {
      return {
        title: "调整节奏",
        text: "当前趋势暂时没有靠近目标，先稳住记录节奏，下一步补一条容易完成的记录。",
      };
    }

    if (healthProgress.progressPercent >= 80 || runProgress.progressPercent >= 80) {
      return {
        title: "接近目标",
        text: "已经接近目标，继续保持当前节奏，比临时加量更容易看清变化。",
      };
    }

    if (todayHealth || todayRuns.length > 0) {
      return {
        title: "今日已开始",
        text: "今天已经有记录了，后续数据越稳定，趋势和预计时间会越有参考价值。",
      };
    }

    if (!hasAnyRecord) {
      return {
        title: "从今天开始",
        text: "先记录今天的一项数据，后面的趋势和目标差距会更清楚。",
      };
    }

    return {
      title: "继续补齐",
      text: "数据还不够完整，先保持简单记录，等记录变多后再看趋势判断。",
    };
  };

  const encouragement = buildEncouragement();

  return {
    localDate: todayLocalDate,
    focusMetrics,
    todayBattle,
    runWeek,
    antiSlacking,
    statusItems,
    metricCards,
    chartPanels,
    progressCards,
    encouragement,
  };
}
