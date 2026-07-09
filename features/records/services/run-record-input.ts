import { validateLocalDate } from "./records-service.ts";
import { calculatedPaceRule, runRecordInputRules } from "../constants/record-input-rules.ts";

export type RunRecordFormValues = {
  distanceKm: string;
  durationMinutes: string;
  paceMinutesPerKm: string;
  averageHeartRateBpm: string;
  averageStrideMeters: string;
  cadenceSpm: string;
};

export type RunRecordEditFormValues = RunRecordFormValues & {
  localDate: string;
};

export type RunRecordFieldErrors = Partial<Record<keyof RunRecordFormValues, string>> & {
  form?: string;
  localDate?: string;
};

export type ParsedRunRecordInput =
  | {
      ok: true;
      data: {
        distanceKm: number;
        durationSeconds?: number;
        paceSecondsPerKm?: number;
        averageHeartRateBpm?: number;
        averageStrideMeters?: number;
        cadenceSpm?: number;
      };
      values: RunRecordFormValues;
    }
  | {
      ok: false;
      fieldErrors: RunRecordFieldErrors;
      values: RunRecordFormValues;
    };

const FIELD_LABELS = {
  distanceKm: runRecordInputRules.distanceKm.label,
  durationMinutes: runRecordInputRules.durationMinutes.label,
  paceMinutesPerKm: "配速",
  averageHeartRateBpm: runRecordInputRules.averageHeartRateBpm.label,
  averageStrideMeters: runRecordInputRules.averageStrideMeters.label,
  cadenceSpm: runRecordInputRules.cadenceSpm.label,
} as const;

const FIELD_RULES = {
  distanceKm: runRecordInputRules.distanceKm,
  durationMinutes: runRecordInputRules.durationMinutes,
  averageHeartRateBpm: runRecordInputRules.averageHeartRateBpm,
  averageStrideMeters: runRecordInputRules.averageStrideMeters,
  cadenceSpm: runRecordInputRules.cadenceSpm,
} as const;

function parseOptionalPositiveNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { empty: true as const };
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { empty: false as const, valid: false as const };
  }

  return { empty: false as const, valid: true as const, value: parsed };
}

function createRangeError(key: keyof typeof FIELD_RULES) {
  const rule = FIELD_RULES[key];
  const valueType = "integer" in rule && rule.integer ? "整数" : "数字";
  return `${FIELD_LABELS[key]}请输入 ${rule.min}-${rule.max} ${rule.unit}范围内的${valueType}`;
}

function setRangeFieldError(errors: RunRecordFieldErrors, key: keyof typeof FIELD_RULES) {
  errors[key] = createRangeError(key);
}

function isOutOfRange(key: keyof typeof FIELD_RULES, value: number) {
  const rule = FIELD_RULES[key];
  return value < rule.min || value > rule.max;
}

export function parseRunRecordFormValues(values: RunRecordFormValues): ParsedRunRecordInput {
  const fieldErrors: RunRecordFieldErrors = {};

  const distance = parseOptionalPositiveNumber(values.distanceKm);
  if (distance.empty || !distance.valid) {
    fieldErrors.distanceKm = distance.empty ? "请填写公里数" : createRangeError("distanceKm");
  } else if (isOutOfRange("distanceKm", distance.value)) {
    setRangeFieldError(fieldErrors, "distanceKm");
  }

  const duration = parseOptionalPositiveNumber(values.durationMinutes);
  if (!duration.empty && !duration.valid) {
    setRangeFieldError(fieldErrors, "durationMinutes");
  } else if (
    !duration.empty &&
    duration.valid &&
    (!Number.isInteger(duration.value) || isOutOfRange("durationMinutes", duration.value))
  ) {
    setRangeFieldError(fieldErrors, "durationMinutes");
  }

  const heartRate = parseOptionalPositiveNumber(values.averageHeartRateBpm);
  if (!heartRate.empty && (!heartRate.valid || !Number.isInteger(heartRate.value))) {
    setRangeFieldError(fieldErrors, "averageHeartRateBpm");
  } else if (!heartRate.empty && heartRate.valid && isOutOfRange("averageHeartRateBpm", heartRate.value)) {
    setRangeFieldError(fieldErrors, "averageHeartRateBpm");
  }

  const stride = parseOptionalPositiveNumber(values.averageStrideMeters);
  if (!stride.empty && !stride.valid) {
    setRangeFieldError(fieldErrors, "averageStrideMeters");
  } else if (!stride.empty && stride.valid && isOutOfRange("averageStrideMeters", stride.value)) {
    setRangeFieldError(fieldErrors, "averageStrideMeters");
  }

  const cadence = parseOptionalPositiveNumber(values.cadenceSpm);
  if (!cadence.empty && (!cadence.valid || !Number.isInteger(cadence.value))) {
    setRangeFieldError(fieldErrors, "cadenceSpm");
  } else if (!cadence.empty && cadence.valid && isOutOfRange("cadenceSpm", cadence.value)) {
    setRangeFieldError(fieldErrors, "cadenceSpm");
  }

  if (
    !distance.empty &&
    distance.valid &&
    !duration.empty &&
    duration.valid &&
    !fieldErrors.distanceKm &&
    !fieldErrors.durationMinutes
  ) {
    const paceMinutesPerKm = duration.value / distance.value;
    if (
      paceMinutesPerKm < calculatedPaceRule.minMinutesPerKm ||
      paceMinutesPerKm > calculatedPaceRule.maxMinutesPerKm
    ) {
      fieldErrors.durationMinutes = "配速看起来不合理，请检查公里数和运动时长";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values };
  }

  const distanceKm = !distance.empty && distance.valid ? distance.value : 0;
  const durationValue = !duration.empty && duration.valid ? duration.value : undefined;
  const heartRateValue = !heartRate.empty && heartRate.valid ? heartRate.value : undefined;
  const strideValue = !stride.empty && stride.valid ? stride.value : undefined;
  const cadenceValue = !cadence.empty && cadence.valid ? cadence.value : undefined;

  const durationSeconds = durationValue === undefined ? undefined : Math.round(durationValue * 60);
  const calculatedPaceSeconds =
    durationSeconds === undefined ? undefined : Math.round(durationSeconds / distanceKm);

  return {
    ok: true,
    data: {
      distanceKm,
      ...(durationSeconds === undefined ? {} : { durationSeconds }),
      ...(calculatedPaceSeconds === undefined ? {} : { paceSecondsPerKm: calculatedPaceSeconds }),
      ...(heartRateValue === undefined ? {} : { averageHeartRateBpm: heartRateValue }),
      ...(strideValue === undefined ? {} : { averageStrideMeters: strideValue }),
      ...(cadenceValue === undefined ? {} : { cadenceSpm: cadenceValue }),
    },
    values,
  };
}

export function parseRunRecordEditValues(values: RunRecordEditFormValues) {
  const parsed = parseRunRecordFormValues(values);
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
