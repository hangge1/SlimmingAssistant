import assert from "node:assert/strict";
import { test } from "node:test";

import { parseHealthRecordFormValues } from "../features/records/services/health-record-input.ts";

test("健康记录表单输入会转换为内部单位数值", () => {
  const result = parseHealthRecordFormValues({
    weightKg: "82.4",
    waistCm: "91.2",
    hipCm: "101.5",
    bodyFatPercentage: "24.6",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.ok ? result.data : {}, {
    weightKg: 82.4,
    waistCm: 91.2,
    hipCm: 101.5,
    bodyFatPercentage: 24.6,
  });
});

test("健康记录表单空输入会返回中文表单错误并保留输入", () => {
  const result = parseHealthRecordFormValues({
    weightKg: "",
    waistCm: " ",
    hipCm: "",
    bodyFatPercentage: "",
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok ? "" : result.fieldErrors.form, "请至少填写一项健康数据");
  assert.deepEqual(result.ok ? {} : result.values, {
    weightKg: "",
    waistCm: " ",
    hipCm: "",
    bodyFatPercentage: "",
  });
});

test("健康记录表单非法数值会返回字段错误并保留输入", () => {
  const result = parseHealthRecordFormValues({
    weightKg: "-1",
    waistCm: "abc",
    hipCm: "0",
    bodyFatPercentage: "120",
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok ? "" : result.fieldErrors.weightKg, "体重请输入 30-250 公斤范围内的数字");
  assert.equal(result.ok ? "" : result.fieldErrors.waistCm, "腰围请输入 40-200 厘米范围内的数字");
  assert.equal(result.ok ? "" : result.fieldErrors.hipCm, "臀围请输入 50-220 厘米范围内的数字");
  assert.equal(result.ok ? "" : result.fieldErrors.bodyFatPercentage, "体脂率请输入 3-70%范围内的数字");
  assert.equal(result.ok ? "" : result.values.waistCm, "abc");
});

test("健康记录表单会拒绝超出常规人体范围的数据", () => {
  const result = parseHealthRecordFormValues({
    weightKg: "251",
    waistCm: "39.9",
    hipCm: "221",
    bodyFatPercentage: "2.9",
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok ? "" : result.fieldErrors.weightKg, "体重请输入 30-250 公斤范围内的数字");
  assert.equal(result.ok ? "" : result.fieldErrors.waistCm, "腰围请输入 40-200 厘米范围内的数字");
  assert.equal(result.ok ? "" : result.fieldErrors.hipCm, "臀围请输入 50-220 厘米范围内的数字");
  assert.equal(result.ok ? "" : result.fieldErrors.bodyFatPercentage, "体脂率请输入 3-70%范围内的数字");
});
