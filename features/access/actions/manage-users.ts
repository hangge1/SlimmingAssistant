"use server";

import { revalidatePath } from "next/cache";
import { createUserRepository } from "../repositories/user-repository.ts";
import { disableManagedUser, updateManagedUser } from "../services/admin-user-service.ts";
import { requireUserAuthContext } from "../services/route-guards";

function getRequiredString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function requireAdmin(auth: Awaited<ReturnType<typeof requireUserAuthContext>>) {
  if (auth.role !== "admin") {
    return { ok: false as const, fieldErrors: { form: "只有管理员可以管理用户" } };
  }

  return { ok: true as const };
}

export async function updateManagedUserAction(formData: FormData) {
  const auth = await requireUserAuthContext();
  const allowed = requireAdmin(auth);
  if (!allowed.ok) {
    return;
  }

  await updateManagedUser(createUserRepository(), {
    currentAdminUserId: auth.userId,
    userId: getRequiredString(formData, "userId"),
    displayName: getRequiredString(formData, "displayName"),
    role: getRequiredString(formData, "role"),
    password: getRequiredString(formData, "password"),
    confirmPassword: getRequiredString(formData, "confirmPassword"),
  });

  revalidatePath("/settings");
}

export async function disableManagedUserAction(formData: FormData) {
  const auth = await requireUserAuthContext();
  const allowed = requireAdmin(auth);
  if (!allowed.ok) {
    return;
  }

  if (getRequiredString(formData, "confirmDisable") !== "yes") {
    return;
  }

  await disableManagedUser(createUserRepository(), {
    currentAdminUserId: auth.userId,
    userId: getRequiredString(formData, "userId"),
  });

  revalidatePath("/settings");
}
