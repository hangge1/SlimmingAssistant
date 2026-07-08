import type { VerifyAccessPasswordState } from "../actions/access-form-state";
import { Button } from "@/components/ui/button";

type VerifyAccessPasswordFormProps = {
  fieldErrors?: VerifyAccessPasswordState["fieldErrors"];
};

export function VerifyAccessPasswordForm({ fieldErrors = {} }: VerifyAccessPasswordFormProps) {
  return (
    <div className="grid gap-4">
      <form action="verify/submit" className="grid gap-4" method="post">
        {fieldErrors.form ? (
          <p className="rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
            {fieldErrors.form}
          </p>
        ) : null}

        <div className="grid gap-2">
          <label htmlFor="username" className="text-sm font-semibold text-[var(--ink-primary)]">
            用户名
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            placeholder="请输入用户名"
            aria-invalid={fieldErrors.username ? "true" : undefined}
            aria-describedby={fieldErrors.username ? "username-error" : undefined}
            className="min-h-11 rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm text-[var(--ink-primary)]"
          />
          {fieldErrors.username ? (
            <p id="username-error" className="text-sm text-[var(--danger)]">
              {fieldErrors.username}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label htmlFor="password" className="text-sm font-semibold text-[var(--ink-primary)]">
            密码
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="请输入密码"
            aria-invalid={fieldErrors.password ? "true" : undefined}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            className="min-h-11 rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm text-[var(--ink-primary)]"
          />
          {fieldErrors.password ? (
            <p id="password-error" className="text-sm text-[var(--danger)]">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <Button type="submit">登录</Button>
      </form>

      <form action="guest/submit" method="post">
        <Button className="w-full" type="submit" variant="secondary">
          访客体验
        </Button>
      </form>
    </div>
  );
}
