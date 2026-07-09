import { validateLocalDate } from "./records-service.ts";
import { healthRecordInputRules } from "../constants/record-input-rules.ts";

export type HealthRecordFormValues = {
  weightKg: string;
  waistCm: string;
  hipCm: string;
  bodyFatPercentage: string;
};

export type HealthRecordEditFormValues = HealthRecordFormValues & {
  localDate: string;
};

export type HealthRecordFieldErrors = Partial<Record<keyof HealthRecordFormValues, string>> & {
  form?: string;
  localDate?: string;
};

export type ParsedHealthRecordInput =
  | {
      ok: true;
      data: {
        weightKg?: number;
        waistCm?: number;
        hipCm?: number;
        bodyFatPercentage?: number;
      };
      values: HealthRecordFormValues;
    }
  | {
      ok: false;
      fieldErrors: HealthRecordFieldErrors;
      values: HealthRecordFormValues;
    };

const FIELD_RULES = {
  weightKg: healthRecordInputRules.weightKg,
  waistCm: healthRecordInputRules.waistCm,
  hipCm: healthRecordInputRules.hipCm,
  bodyFatPercentage: healthRecordInputRules.bodyFatPercentage,
} as const;

function parsePositiveNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { empty: true as const };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return { empty: false as const, valid: false as const };
  }

  return { empty: false as const, valid: true as const, value: parsed };
}

function createRangeError(rule: (typeof FIELD_RULES)[keyof typeof FIELD_RULES]) {
  const unitText = rule.unit === "%" ? "%" : ` ${rule.unit}`;
  return `${rule.label}请输入 ${rule.min}-${rule.max}${unitText}范围内的数字`;
}

export function parseHealthRecordFormValues(values: HealthRecordFormValues): ParsedHealthRecordInput {
  const fieldErrors: HealthRecordFieldErrors = {};
  const data: Extract<ParsedHealthRecordInput, { ok: true }>["data"] = {};
  let filledCount = 0;

  for (const key of Object.keys(FIELD_RULES) as Array<keyof typeof FIELD_RULES>) {
    const rule = FIELD_RULES[key];
    const parsed = parsePositiveNumber(values[key]);

    if (parsed.empty) {
      continue;
    }

    filledCount += 1;

    if (!parsed.valid) {
      fieldErrors[key] = createRangeError(rule);
      continue;
    }

    if (parsed.value < rule.min || parsed.value > rule.max) {
      fieldErrors[key] = createRangeError(rule);
      continue;
    }

    data[key] = parsed.value;
  }

  if (filledCount === 0) {
    fieldErrors.form = "请至少填写一项健康数据";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values };
  }

  return { ok: true, data, values };
}

export function parseHealthRecordEditValues(values: HealthRecordEditFormValues) {
  const parsed = parseHealthRecordFormValues(values);
  const dateValidation = validateLocalDate(values.localDate);

  if (parsed.ok && dateValidation.ok) {
    return {
      ok: true as const,
      data: {
        localDate: values.localDate,
        ...parsed.data,
      },
      values,
    };
  }

  return {
    ok: false as const,
    fieldErrors: {
      ...(parsed.ok ? {} : parsed.fieldErrors),
      ...(dateValidation.ok ? {} : dateValidation.fieldErrors),
    },
    values,
  };
}
