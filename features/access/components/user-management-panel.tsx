"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createManagedUserAction } from "../actions/create-managed-user";
import { initialCreateManagedUserFormState } from "../actions/managed-user-form-state";
import type { UserRole } from "../services/auth-context";

type UserListItem = {
  id: string;
  username: string;
  displayName: string | null;
  role: UserRole;
  disabledAtIso: string | null;
};

type UserManagementPanelProps = {
  users: UserListItem[];
  listError?: string;
};

const roleLabels: Record<UserRole, string> = {
  admin: "管理员",
  user: "普通用户",
};

export function UserManagementPanel({ users, listError = "" }: UserManagementPanelProps) {
  const [state, formAction, pending] = useActionState(createManagedUserAction, initialCreateManagedUserFormState);
  const values = state?.values ?? initialCreateManagedUserFormState.values;
  const fieldErrors = state?.fieldErrors ?? initialCreateManagedUserFormState.fieldErrors;

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        {listError ? (
          <p className="rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
            {listError}
          </p>
        ) : null}
        {users.map((user) => (
          <div
            className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 py-2 text-sm"
            key={user.id}
          >
            <div className="min-w-0">
              <p className="m-0 truncate font-black text-[var(--ink-primary)]">{user.username}</p>
              <p className="m-0 truncate text-xs font-semibold text-[var(--ink-secondary)]">
                {user.displayName || "未设置昵称"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-[rgba(47,109,179,0.1)] px-2 py-1 text-xs font-black text-[var(--primary)]">
                {roleLabels[user.role]}
              </span>
              {user.disabledAtIso ? (
                <span className="rounded-full bg-[var(--danger-soft)] px-2 py-1 text-xs font-black text-[var(--danger)]">
                  已停用
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <form action={formAction} className="grid gap-3 border-t border-[var(--border-soft)] pt-4">
        <h3 className="m-0 text-base font-black text-[var(--ink-primary)]">新增用户</h3>

        {state?.successMessage ? (
          <p className="rounded-md border border-[var(--health)] bg-[var(--health-soft)] px-3 py-2 text-sm text-[var(--ink-primary)]">
            {state.successMessage}
          </p>
        ) : null}

        {fieldErrors.form ? (
          <p className="rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
            {fieldErrors.form}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="managedUsername" className="text-sm font-semibold text-[var(--ink-primary)]">
              用户名
            </label>
            <input
              autoComplete="username"
              className="min-h-11 rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm text-[var(--ink-primary)]"
              defaultValue={values.username}
              id="managedUsername"
              name="username"
            />
            {fieldErrors.username ? <p className="text-sm text-[var(--danger)]">{fieldErrors.username}</p> : null}
          </div>

          <div className="grid gap-2">
            <label htmlFor="managedDisplayName" className="text-sm font-semibold text-[var(--ink-primary)]">
              显示名称
            </label>
            <input
              className="min-h-11 rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm text-[var(--ink-primary)]"
              defaultValue={values.displayName}
              id="managedDisplayName"
              name="displayName"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="managedRole" className="text-sm font-semibold text-[var(--ink-primary)]">
              角色
            </label>
            <select
              className="min-h-11 rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm text-[var(--ink-primary)]"
              defaultValue={values.role}
              id="managedRole"
              name="role"
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
            {fieldErrors.role ? <p className="text-sm text-[var(--danger)]">{fieldErrors.role}</p> : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="managedPassword" className="text-sm font-semibold text-[var(--ink-primary)]">
              初始密码
            </label>
            <input
              autoComplete="new-password"
              className="min-h-11 rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm text-[var(--ink-primary)]"
              id="managedPassword"
              name="password"
              type="password"
            />
            {fieldErrors.password ? <p className="text-sm text-[var(--danger)]">{fieldErrors.password}</p> : null}
          </div>

          <div className="grid gap-2">
            <label htmlFor="managedConfirmPassword" className="text-sm font-semibold text-[var(--ink-primary)]">
              确认密码
            </label>
            <input
              autoComplete="new-password"
              className="min-h-11 rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm text-[var(--ink-primary)]"
              id="managedConfirmPassword"
              name="confirmPassword"
              type="password"
            />
            {fieldErrors.confirmPassword ? (
              <p className="text-sm text-[var(--danger)]">{fieldErrors.confirmPassword}</p>
            ) : null}
          </div>
        </div>

        <div>
          <Button disabled={pending} type="submit">
            新增用户
          </Button>
        </div>
      </form>
    </div>
  );
}
