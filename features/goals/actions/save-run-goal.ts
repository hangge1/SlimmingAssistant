"use server";

import { revalidatePath } from "next/cache";
import { requireTrustedDevice } from "@/features/access/services/route-guards";
import { createGoalsRepository } from "../repositories/goals-repository.ts";
import { saveRunGoal } from "../services/goals-service.ts";
import { parseRunGoalFormValues } from "../services/run-goal-input.ts";
import { runGoalToFormValues, type RunGoalFormState } from "./run-goal-form-state";

function formDataToValues(formData: FormData) {
  return {
    weeklyRunCount: String(formData.get("weeklyRunCount") ?? ""),
    weeklyDistanceKm: String(formData.get("weeklyDistanceKm") ?? ""),
  };
}

export async function saveRunGoalAction(
  _previousState: RunGoalFormState,
  formData: FormData,
): Promise<RunGoalFormState> {
  await requireTrustedDevice();

  const values = formDataToValues(formData);
  const parsed = parseRunGoalFormValues(values);

  if (!parsed.ok) {
    return {
      values: parsed.values,
      fieldErrors: parsed.fieldErrors,
    };
  }

  const saved = saveRunGoal(createGoalsRepository(), {
    ...parsed.data,
    nowIso: new Date().toISOString(),
  });

  if (!saved.ok) {
    const formMessage = "error" in saved ? saved.error.message : "跑步目标保存失败";
    return {
      values,
      fieldErrors: { form: formMessage },
    };
  }

  revalidatePath("/goals");
  revalidatePath("/");
  revalidatePath("/data");

  return {
    values: runGoalToFormValues(saved.data),
    fieldErrors: {},
    successMessage: "已保存跑步目标",
  };
}
