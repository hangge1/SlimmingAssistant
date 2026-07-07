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

export type UpdateManagedUserInput = {
  currentAdminUserId: string;
  userId: string;
  displayName: string;
  role: string;
  password: string;
  confirmPassword: string;
  nowIso?: string;
};

export type DisableManagedUserInput = {
  currentAdminUserId: string;
  userId: string;
  nowIso?: string;
};

export type ManagedUserMutationResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors: {
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

function getActiveAdminCount(repository: UserRepository) {
  const users = repository.listUsers();
  if (!users.ok) {
    return users;
  }

  return {
    ok: true as const,
    data: users.data.filter((user) => !user.disabledAtIso && user.role === "admin").length,
  };
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

export async function updateManagedUser(
  repository: UserRepository,
  input: UpdateManagedUserInput,
): Promise<ManagedUserMutationResult> {
  const role = normalizeRole(input.role);
  const password = input.password;
  const confirmPassword = input.confirmPassword;
  const fieldErrors: Extract<ManagedUserMutationResult, { ok: false }>["fieldErrors"] = {};

  if (!role) {
    fieldErrors.role = "请选择有效角色";
  }

  if (password || confirmPassword) {
    fieldErrors.password = validatePassword(password);

    if (password && !confirmPassword) {
      fieldErrors.confirmPassword = "请确认密码";
    } else if (password && confirmPassword && password !== confirmPassword) {
      fieldErrors.confirmPassword = "两次输入的密码不一致";
    }
  }

  for (const key of Object.keys(fieldErrors) as Array<keyof typeof fieldErrors>) {
    if (!fieldErrors[key]) {
      delete fieldErrors[key];
    }
  }

  if (Object.keys(fieldErrors).length > 0 || !role) {
    return { ok: false, fieldErrors };
  }

  const target = repository.getAnyUserById(input.userId);
  if (!target.ok) {
    return { ok: false, fieldErrors: { form: target.error.message } };
  }

  if (!target.data || target.data.disabledAtIso) {
    return { ok: false, fieldErrors: { form: "用户不存在或已停用" } };
  }

  if (target.data.id === input.currentAdminUserId && role !== "admin") {
    return { ok: false, fieldErrors: { role: "不能取消自己的管理员角色" } };
  }

  if (target.data.role === "admin" && role !== "admin") {
    const activeAdminCount = getActiveAdminCount(repository);
    if (!activeAdminCount.ok) {
      return { ok: false, fieldErrors: { form: activeAdminCount.error.message } };
    }

    if (activeAdminCount.data <= 1) {
      return { ok: false, fieldErrors: { role: "不能移除最后一个管理员" } };
    }
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const updated = repository.updateUser({
    userId: input.userId,
    displayName: input.displayName.trim() || null,
    role,
    nowIso,
  });

  if (!updated.ok) {
    return { ok: false, fieldErrors: { form: updated.error.message } };
  }

  if (password) {
    const passwordHash = await hashAccessPassword(password);
    const savedPassword = repository.updateUserPassword({
      userId: input.userId,
      passwordHash: passwordHash.hash,
      passwordHashAlgorithm: passwordHash.algorithm,
      nowIso,
    });

    if (!savedPassword.ok) {
      return { ok: false, fieldErrors: { form: savedPassword.error.message } };
    }

    repository.revokeUserSessions(input.userId, nowIso);
  }

  return { ok: true };
}

export function disableManagedUser(
  repository: UserRepository,
  input: DisableManagedUserInput,
): ManagedUserMutationResult {
  if (input.userId === input.currentAdminUserId) {
    return { ok: false, fieldErrors: { form: "不能停用当前登录账号" } };
  }

  const target = repository.getAnyUserById(input.userId);
  if (!target.ok) {
    return { ok: false, fieldErrors: { form: target.error.message } };
  }

  if (!target.data || target.data.disabledAtIso) {
    return { ok: false, fieldErrors: { form: "用户不存在或已停用" } };
  }

  if (target.data.role === "admin") {
    const activeAdminCount = getActiveAdminCount(repository);
    if (!activeAdminCount.ok) {
      return { ok: false, fieldErrors: { form: activeAdminCount.error.message } };
    }

    if (activeAdminCount.data <= 1) {
      return { ok: false, fieldErrors: { form: "不能停用最后一个管理员" } };
    }
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const disabled = repository.disableUser(input.userId, nowIso);
  if (!disabled.ok) {
    return { ok: false, fieldErrors: { form: disabled.error.message } };
  }

  const revoked = repository.revokeUserSessions(input.userId, nowIso);
  if (!revoked.ok) {
    return { ok: false, fieldErrors: { form: revoked.error.message } };
  }

  return { ok: true };
}
