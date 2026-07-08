import { redirect } from "next/navigation";
import type { CreateAccessPasswordState } from "@/features/access/actions/access-form-state";
import { CreateAccessPasswordForm } from "@/features/access/components/create-access-password-form";
import { createUserRepository } from "@/features/access/repositories/user-repository";

export const dynamic = "force-dynamic";

type CreateAccessPasswordPageProps = {
  searchParams?: Promise<{
    username?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  }>;
};

export default async function CreateAccessPasswordPage({ searchParams }: CreateAccessPasswordPageProps) {
  const userRepository = createUserRepository();
  userRepository.ensureLegacyDefaultAdmin(new Date().toISOString());
  const activeUsers = userRepository.countActiveUsers();

  if (activeUsers.ok && activeUsers.data > 0) {
    redirect("/");
  }

  const params = await searchParams;
  const fieldErrors: CreateAccessPasswordState["fieldErrors"] = {
    username: params?.username,
    password: params?.password,
    confirmPassword: params?.confirmPassword,
    form: params?.form,
  };

  return (
    <main className="auth-page">
      <div aria-hidden="true" className="auth-motion-scene">
        <span className="auth-runner" />
        <span className="auth-lane auth-lane--one" />
        <span className="auth-lane auth-lane--two" />
      </div>
      <section className="auth-card">
        <div className="auth-card__header">
          <p className="auth-brand">跑步瘦身助手</p>
          <h1 className="auth-title">创建管理员账号</h1>
          <p className="auth-description">
            第一次使用前先创建管理员。第一个账号会自动拥有用户管理权限。
          </p>
        </div>
        <CreateAccessPasswordForm fieldErrors={fieldErrors} />
      </section>
    </main>
  );
}
