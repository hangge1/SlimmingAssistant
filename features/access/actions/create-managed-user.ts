"use server";

import { revalidatePath } from "next/cache";
import { createUserRepository } from "../repositories/user-repository.ts";
import { requireUserAuthContext } from "../services/route-guards";
import { createManagedUser } from "../services/admin-user-service.ts";
import { initialCreateManagedUserFormState, type CreateManagedUserFormState } from "./managed-user-form-state";

function formDataToValues(formData: FormData) {
  return {
    username: String(formData.get("username") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    role: String(formData.get("role") ?? "user"),
  };
}

export async function createManagedUserAction(
  _previousState: CreateManagedUserFormState,
  formData: FormData,
): Promise<CreateManagedUserFormState> {
  const auth = await requireUserAuthContext();
  const values = formDataToValues(formData);

  if (auth.role !== "admin") {
    return {
      values,
      fieldErrors: { form: "只有管理员可以新增用户" },
    };
  }

  const created = await createManagedUser(createUserRepository(), {
    ...values,
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!created.ok) {
    return {
      values,
      fieldErrors: created.fieldErrors,
    };
  }

  revalidatePath("/settings");

  return {
    values: initialCreateManagedUserFormState.values,
    fieldErrors: {},
    successMessage: "已新增用户",
  };
}
