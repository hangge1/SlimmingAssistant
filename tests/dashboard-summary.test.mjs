import assert from "node:assert/strict";
import { test } from "node:test";

import { createDashboardSummary } from "../features/dashboard/services/dashboard-summary.ts";

function createMockRepositories({
  healthToday = null,
  latestHealth = [],
  todayRuns = [],
  allRuns = todayRuns,
  healthGoal = null,
  runGoal = null,
}) {
  return {
    recordsRepository: {
      getHealthRecordByDate() {
        return { ok: true, data: healthToday };
      },
      listHealthRecords() {
        return { ok: true, data: latestHealth };
      },
      listRunRecordsByDate() {
        return { ok: true, data: todayRuns };
      },
      listRunRecords() {
        return { ok: true, data: allRuns };
      },
    },
    goalsRepository: {
      getGoalByType(type) {
        return { ok: true, data: type === "health" ? healthGoal : runGoal };
      },
    },
  };
}

test("首页摘要会展示今日健康记录、今日跑步记录和目标状态", () => {
  const { recordsRepository, goalsRepository } = createMockRepositories({
    healthToday: {
      id: "health-1",
      localDate: "2026-06-26",
      weightKg: 76.5,
      waistCm: 82,
      hipCm: null,
      bodyFatPercentage: 18,
      createdAtIso: "2026-06-26T00:00:00.000Z",
      updatedAtIso: "2026-06-26T00:00:00.000Z",
    },
    latestHealth: [],
    todayRuns: [
      { id: "run-1", localDate: "2026-06-26", distanceKm: 5, createdAtIso: "", updatedAtIso: "" },
      { id: "run-2", localDate: "2026-06-26", distanceKm: 3.2, createdAtIso: "", updatedAtIso: "" },
    ],
    healthGoal: { id: "goal-health", type: "health", targetWeightKg: 72 },
    runGoal: { id: "goal-run", type: "run", weeklyRunCount: 3, weeklyDistanceKm: 18 },
  });

  const summary = createDashboardSummary({
    recordsRepository,
    goalsRepository,
    todayLocalDate: "2026-06-26",
  });

  assert.equal(summary.localDate, "2026-06-26");
  assert.deepEqual(
    summary.statusItems.map((item) => [item.label, item.value, item.href]),
    [
      ["身体数据", "已记录", "/records"],
      ["跑步记录", "已记录 2 次", "/records"],
      ["提醒状态", "未开启提醒", "/settings"],
      ["目标设置", "已设置", "/goals"],
    ],
  );
  assert.equal(summary.metricCards[0].title, "健康摘要");
  assert.equal(summary.metricCards[0].value, "76.5");
  assert.equal(summary.metricCards[0].unit, "公斤");
  assert.equal(summary.metricCards[1].title, "运动摘要");
  assert.equal(summary.metricCards[1].value, "8.2");
  assert.equal(summary.metricCards[1].unit, "公里");
  assert.match(summary.metricCards[1].description, /今天已记录 2 次跑步/);
  assert.equal(summary.metricCards[2].title, "目标摘要");
  assert.equal(summary.metricCards[2].value, "还差 4.5");
  assert.equal(summary.metricCards[2].unit, "公斤");
  assert.match(summary.metricCards[2].description, /健康目标：当前 76.5 公斤，目标 72 公斤/);
  assert.match(summary.metricCards[2].description, /跑步目标：最近 7 天还差 1 次 \/ 9.8 公里/);
});

test("首页摘要在空数据时返回中文引导状态", () => {
  const { recordsRepository, goalsRepository } = createMockRepositories({});
  const summary = createDashboardSummary({
    recordsRepository,
    goalsRepository,
    todayLocalDate: "2026-06-26",
  });

  assert.equal(summary.statusItems[0].value, "待记录");
  assert.equal(summary.statusItems[1].value, "待添加");
  assert.equal(summary.statusItems[2].value, "未开启提醒");
  assert.equal(summary.statusItems[3].value, "待设置");
  assert.equal(summary.metricCards[0].value, "暂无数据");
  assert.equal(summary.metricCards[1].value, "暂无跑量");
  assert.equal(summary.metricCards[2].value, "未设置");
  assert.equal(summary.progressCards[0].status, "未设置");
  assert.match(summary.progressCards[0].estimate, /无法可靠估算/);
  assert.match(summary.encouragement.text, /先记录今天/);
  assert.equal(summary.chartPanels[0].title, "健康曲线");
  assert.equal(summary.chartPanels[1].title, "运动曲线");
  assert.equal(summary.chartPanels[0].periodOptions[0].metrics[0].label, "体重");
  assert.equal(summary.chartPanels[0].periodOptions[0].metrics[3].label, "BMI");
  assert.equal(summary.chartPanels[0].periodOptions[0].metrics[3].value, "待设置身高");
  assert.equal(summary.chartPanels[1].periodOptions[0].metrics[0].label, "每日跑量");
  assert.equal("trendCards" in summary, false);
});

test("首页摘要会计算健康曲线、跑步曲线和 BMI 指标", () => {
  const { recordsRepository, goalsRepository } = createMockRepositories({
    latestHealth: [
      {
        id: "health-new",
        localDate: "2026-06-26",
        weightKg: 75,
        waistCm: 81,
        hipCm: 96,
        bodyFatPercentage: 17,
        createdAtIso: "",
        updatedAtIso: "",
      },
      {
        id: "health-old",
        localDate: "2026-06-20",
        weightKg: 76.2,
        waistCm: 82,
        hipCm: 97,
        bodyFatPercentage: 18,
        createdAtIso: "",
        updatedAtIso: "",
      },
    ],
    allRuns: [
      { id: "run-1", localDate: "2026-06-26", distanceKm: 5, paceSecondsPerKm: 360, createdAtIso: "", updatedAtIso: "" },
      { id: "run-2", localDate: "2026-06-22", distanceKm: 4.5, paceSecondsPerKm: 390, createdAtIso: "", updatedAtIso: "" },
    ],
  });

  const summary = createDashboardSummary({
    recordsRepository,
    goalsRepository,
    todayLocalDate: "2026-06-26",
    heightCm: 175,
  });

  assert.match(summary.metricCards[0].description, /BMI 24.5/);
  assert.deepEqual(
    summary.chartPanels[0].periodOptions.map((option) => option.label),
    ["最近 7 天", "最近 30 天", "最近半年", "最近 1 年"],
  );
  assert.equal(summary.chartPanels[0].periodOptions[0].days, 7);
  assert.equal(summary.chartPanels[0].periodOptions[0].startLocalDate, "2026-06-20");
  assert.equal(summary.chartPanels[0].periodOptions[0].endLocalDate, "2026-06-26");
  const healthDefaultOption = summary.chartPanels[0].periodOptions[0];
  const healthMonthOption = summary.chartPanels[0].periodOptions.find((option) => option.days === 30);
  assert.equal(healthMonthOption.startLocalDate, "2026-05-28");
  assert.equal(healthMonthOption.endLocalDate, "2026-06-26");
  assert.deepEqual(
    healthDefaultOption.metrics.map((metric) => metric.label),
    ["体重", "腰围", "体脂率", "BMI"],
  );
  assert.equal(healthDefaultOption.metrics[0].value, "75");
  assert.equal(healthDefaultOption.metrics[0].change, "变化 -1.2 公斤");
  assert.equal(healthDefaultOption.metrics[3].value, "24.5");
  assert.equal(healthMonthOption.metrics[0].change, "变化 -1.2 公斤");
  assert.deepEqual(
    summary.chartPanels[1].periodOptions.map((option) => option.label),
    ["最近 7 天", "最近 30 天", "最近半年", "最近 1 年"],
  );
  const runDefaultOption = summary.chartPanels[1].periodOptions[0];
  const runMonthOption = summary.chartPanels[1].periodOptions.find((option) => option.days === 30);
  assert.deepEqual(
    runDefaultOption.metrics.map((metric) => metric.label),
    ["每日跑量", "跑步次数", "平均配速", "平均心率"],
  );
  assert.equal(runDefaultOption.metrics[0].points.length, 7);
  assert.equal(runDefaultOption.metrics[0].points.at(-1).value, 5);
  assert.equal(runDefaultOption.metrics[2].value, "6");
  assert.equal(runMonthOption.metrics[0].points.length, 30);
});

test("首页摘要会计算健康和跑步目标进度及预计达成时间", () => {
  const { recordsRepository, goalsRepository } = createMockRepositories({
    latestHealth: [
      { id: "h3", localDate: "2026-06-26", weightKg: 75, createdAtIso: "", updatedAtIso: "" },
      { id: "h2", localDate: "2026-06-22", weightKg: 76, createdAtIso: "", updatedAtIso: "" },
      { id: "h1", localDate: "2026-06-18", weightKg: 77, createdAtIso: "", updatedAtIso: "" },
    ],
    allRuns: [
      { id: "r1", localDate: "2026-06-26", distanceKm: 3, createdAtIso: "", updatedAtIso: "" },
      { id: "r2", localDate: "2026-06-24", distanceKm: 4, createdAtIso: "", updatedAtIso: "" },
      { id: "r3", localDate: "2026-06-21", distanceKm: 2, createdAtIso: "", updatedAtIso: "" },
    ],
    healthGoal: { id: "goal-health", type: "health", targetWeightKg: 72 },
    runGoal: { id: "goal-run", type: "run", weeklyRunCount: 4, weeklyDistanceKm: 15 },
  });

  const summary = createDashboardSummary({
    recordsRepository,
    goalsRepository,
    todayLocalDate: "2026-06-26",
  });

  assert.equal(summary.progressCards[0].title, "健康目标进度");
  assert.equal(summary.progressCards[0].status, "进行中");
  assert.equal(summary.progressCards[0].currentValue, "75 公斤");
  assert.equal(summary.progressCards[0].targetValue, "72 公斤");
  assert.equal(summary.progressCards[0].gap, "还差 3 公斤");
  assert.match(summary.progressCards[0].estimate, /约 12 天/);
  assert.equal(summary.metricCards[2].value, "还差 3");
  assert.equal(summary.metricCards[2].unit, "公斤");
  assert.match(summary.metricCards[2].description, /跑步目标：最近 7 天还差 1 次 \/ 6 公里/);
  assert.equal(summary.progressCards[1].title, "跑步目标进度");
  assert.equal(summary.progressCards[1].status, "进行中");
  assert.equal(summary.progressCards[1].currentValue, "3 次 / 9 公里");
  assert.equal(summary.progressCards[1].targetValue, "4 次 / 15 公里");
  assert.equal(summary.progressCards[1].gap, "还差 1 次 / 6 公里");
  assert.match(summary.progressCards[1].estimate, /约 5 天/);
});

test("首页摘要会根据目标进度生成克制的中文反馈文案", () => {
  const achieved = createDashboardSummary({
    ...createMockRepositories({
      latestHealth: [
        { id: "h1", localDate: "2026-06-26", weightKg: 71.8, createdAtIso: "", updatedAtIso: "" },
      ],
      healthGoal: { id: "goal-health", type: "health", targetWeightKg: 72 },
    }),
    todayLocalDate: "2026-06-26",
  });
  assert.match(achieved.encouragement.text, /已经达到健康目标/);

  const reverse = createDashboardSummary({
    ...createMockRepositories({
      latestHealth: [
        { id: "h3", localDate: "2026-06-26", weightKg: 77, createdAtIso: "", updatedAtIso: "" },
        { id: "h2", localDate: "2026-06-22", weightKg: 76, createdAtIso: "", updatedAtIso: "" },
        { id: "h1", localDate: "2026-06-18", weightKg: 75, createdAtIso: "", updatedAtIso: "" },
      ],
      healthGoal: { id: "goal-health", type: "health", targetWeightKg: 72 },
    }),
    todayLocalDate: "2026-06-26",
  });
  assert.match(reverse.encouragement.text, /先稳住记录节奏/);

  for (const forbidden of ["失败", "不自律", "必须", "治愈"]) {
    assert.doesNotMatch(achieved.encouragement.text, new RegExp(forbidden));
    assert.doesNotMatch(reverse.encouragement.text, new RegExp(forbidden));
  }
});
