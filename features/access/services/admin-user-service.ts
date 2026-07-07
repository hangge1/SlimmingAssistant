import type { createUserRepository } from "../repositories/user-repository.ts";
import { type UserRole } from "./auth-context.ts";
import { hashAccessPassword } from "./password-hashing.ts";

type UserRepository = ReturnType<typeof createUserRepository>;

export type CreateManagedUserInput = {
  username: string;
  displayName: string;
  role: string;
  password: string;
  confirmPassword: string;
  nowIso?: string;
};

export type CreateManagedUserResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors: {
        username?: string;
        displayName?: string;
        role?: string;
        password?: string;
        confirmPassword?: string;
        form?: string;
      };
    };

function validateUsername(username: string) {
  if (!username) {
    return "请输入用户名";
  }

  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
    return "用户名只能包含 3-32 位字母、数字、下划线或短横线";
  }

  return undefined;
}

function validatePassword(password: string) {
  if (!password) {
    return "请输入密码";
  }

  if (password.length < 8) {
    return "密码至少需要 8 个字符";
  }

  return undefined;
}

function normalizeRole(role: string): UserRole | null {
  return role === "admin" || role === "user" ? role : null;
}

export async function createManagedUser(
  repository: UserRepository,
  input: CreateManagedUserInput,
): Promise<CreateManagedUserResult> {
  const username = input.username.trim();
  const displayName = input.displayName.trim();
  const role = normalizeRole(input.role);
  const fieldErrors: Extract<CreateManagedUserResult, { ok: false }>["fieldErrors"] = {};

  fieldErrors.username = validateUsername(username);
  fieldErrors.password = validatePassword(input.password);

  if (!role) {
    fieldErrors.role = "请选择有效角色";
  }

  if (input.password && !input.confirmPassword) {
    fieldErrors.confirmPassword = "请确认密码";
  } else if (input.password && input.confirmPassword && input.password !== input.confirmPassword) {
    fieldErrors.confirmPassword = "两次输入的密码不一致";
  }

  for (const key of Object.keys(fieldErrors) as Array<keyof typeof fieldErrors>) {
    if (!fieldErrors[key]) {
      delete fieldErrors[key];
    }
  }

  if (Object.keys(fieldErrors).length > 0 || !role) {
    return { ok: false, fieldErrors };
  }

  const passwordHash = await hashAccessPassword(input.password);
  const created = repository.createUser({
    username,
    displayName: displayName || username,
    role,
    passwordHash: passwordHash.hash,
    passwordHashAlgorithm: passwordHash.algorithm,
    nowIso: input.nowIso ?? new Date().toISOString(),
  });

  if (!created.ok) {
    return { ok: false, fieldErrors: { form: created.error.message } };
  }

  return { ok: true };
}
