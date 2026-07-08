"use server";

import { revalidatePath } from "next/cache";
import { requireUserAuthContext } from "@/features/access/services/route-guards";
import { createSettingsRepositoryForAuth } from "@/features/access/services/scoped-repositories";
import { parseProfileFormValues } from "../services/profile-input.ts";
import { getProfileSettings, saveProfileSettings } from "../services/profile-settings-service.ts";
import type { RecipientEmailFormState } from "./recipient-email-form-state";

export async function saveRecipientEmailAction(
  _previousState: RecipientEmailFormState,
  formData: FormData,
): Promise<RecipientEmailFormState> {
  const auth = await requireUserAuthContext();
  const repository = createSettingsRepositoryForAuth(auth);
  const currentProfile = getProfileSettings(repository);
  const reminderEmail = String(formData.get("reminderEmail") ?? "");
  const values = { reminderEmail };

  if (!currentProfile.ok) {
    return {
      values,
      fieldErrors: { form: currentProfile.fieldErrors.form ?? "个人资料读取失败" },
    };
  }

  const parsed = parseProfileFormValues({
    nickname: currentProfile.data.nickname,
    heightCm: currentProfile.data.heightCm == null ? "" : String(currentProfile.data.heightCm),
    reminderEmail,
  });

  if (!parsed.ok) {
    return {
      values,
      fieldErrors: {
        reminderEmail: parsed.fieldErrors.reminderEmail,
        form: parsed.fieldErrors.form,
      },
    };
  }

  const saved = saveProfileSettings(repository, {
    ...currentProfile.data,
    reminderEmail: parsed.data.reminderEmail,
    nowIso: new Date().toISOString(),
  });

  if (!saved.ok) {
    return {
      values,
      fieldErrors: { form: saved.fieldErrors.form ?? "收件邮箱保存失败" },
    };
  }

  revalidatePath("/settings");
  revalidatePath("/");

  return {
    values: { reminderEmail: saved.data.reminderEmail },
    fieldErrors: {},
    successMessage: "已保存收件邮箱",
  };
}
