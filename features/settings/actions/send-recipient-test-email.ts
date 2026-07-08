"use server";

import { revalidatePath } from "next/cache";
import { requireUserAuthContext } from "@/features/access/services/route-guards";
import { createGlobalSettingsRepository } from "@/features/access/services/scoped-repositories";
import { sendTestEmail } from "../services/test-email-service.ts";
import type { RecipientEmailTestFormState } from "./recipient-email-form-state";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function sendRecipientTestEmailAction(
  _previousState: RecipientEmailTestFormState,
  formData: FormData,
): Promise<RecipientEmailTestFormState> {
  await requireUserAuthContext();

  const reminderEmail = String(formData.get("reminderEmail") ?? "").trim();

  if (!isValidEmail(reminderEmail)) {
    return { fieldErrors: { reminderEmail: "请先填写正确的收件邮箱" } };
  }

  const sent = await sendTestEmail(createGlobalSettingsRepository(), {
    recipientEmail: reminderEmail,
    nowIso: new Date().toISOString(),
  });

  if (!sent.ok) {
    return { fieldErrors: sent.fieldErrors };
  }

  revalidatePath("/settings");

  return {
    fieldErrors: {},
    successMessage: sent.data.message,
  };
}
