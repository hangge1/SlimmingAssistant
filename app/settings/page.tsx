import { AppShell } from "@/components/layout/app-shell";
import { requireUserAuthContext } from "@/features/access/services/route-guards";
import {
  createGlobalSettingsRepository,
  createReminderRepositoryForAuth,
  createSettingsRepositoryForAuth,
} from "@/features/access/services/scoped-repositories";
import { AccessProtectionPanel } from "@/features/access/components/access-protection-panel";
import { UserManagementPanel } from "@/features/access/components/user-management-panel";
import { createAccessRepository } from "@/features/access/repositories/access-repository";
import { createUserRepository } from "@/features/access/repositories/user-repository";
import { listTrustedDevices } from "@/features/access/services/access-management-service";
import { ProfileForm } from "@/features/settings/components/profile-form";
import { RecipientEmailForm } from "@/features/settings/components/recipient-email-form";
import { ReminderRuleForm } from "@/features/settings/components/reminder-rule-form";
import { SmtpConfigForm } from "@/features/settings/components/smtp-config-form";
import { TrendThresholdForm } from "@/features/settings/components/trend-threshold-form";
import { getProfileSettings } from "@/features/settings/services/profile-settings-service";
import { getReminderRuleSettings } from "@/features/settings/services/reminder-rule-settings-service";
import { getSmtpConfig } from "@/features/settings/services/smtp-config-service";
import { getTrendThresholdSettings } from "@/features/settings/services/trend-threshold-settings-service";
import { profileToFormValues } from "@/features/settings/actions/profile-form-state";
import { reminderRuleToFormValues } from "@/features/settings/actions/reminder-rule-form-state";
import { smtpConfigToFormValues } from "@/features/settings/actions/smtp-config-form-state";
import { trendThresholdToFormValues } from "@/features/settings/actions/trend-threshold-form-state";

export const dynamic = "force-dynamic";

const settingGroups = [
  {
    title: "个人资料",
    description: "维护昵称和身高。身高会用于后续 BMI 计算。",
    items: ["昵称", "身高（厘米）"],
  },
  {
    title: "邮件接收",
    description: "设置当前账号自己的邮件提醒收件邮箱，SMTP 发信配置由管理员统一维护。",
    items: ["提醒收件邮箱"],
  },
  {
    title: "提醒规则",
    description: "配置每日提醒时间，以及站内提醒和邮件提醒开关。",
    items: ["每日提醒时间", "站内提醒", "邮件提醒"],
  },
  {
    title: "SMTP 邮件",
    description: "维护邮件发送服务器参数，并在后续步骤支持测试邮件。",
    items: ["SMTP 主机", "端口", "安全模式", "发件人地址"],
  },
  {
    title: "用户管理",
    description: "管理员维护可登录账号，新增用户后各自拥有独立数据空间。",
    items: ["用户列表", "新增用户", "角色"],
  },
  {
    title: "趋势估算",
    description: "配置预计达成时间所需的最低统计天数和最低有效记录数。",
    items: ["最低统计天数", "最低有效记录数"],
  },
  {
    title: "访问保护",
    description: "管理访问密码和受信设备，维护当前轻量访问保护状态。",
    items: ["访问密码", "受信设备"],
  },
];

export default async function SettingsPage() {
  const auth = await requireUserAuthContext();

  const repository = createSettingsRepositoryForAuth(auth);
  const globalSettingsRepository = createGlobalSettingsRepository();
  const accessRepository = createAccessRepository(undefined, auth.userId);
  const reminderRepository = createReminderRepositoryForAuth(auth);
  const isAdmin = auth.role === "admin";
  const profile = getProfileSettings(repository);
  const reminderRules = getReminderRuleSettings(repository);
  const smtpConfig = isAdmin ? getSmtpConfig(globalSettingsRepository) : null;
  const userList = isAdmin ? createUserRepository().listUsers() : null;
  const latestEmailReminder = reminderRepository.getLatestEmailReminderEvent();
  const trustedDevices = listTrustedDevices(accessRepository);
  const trendThresholds = getTrendThresholdSettings(repository);
  const profileError = !profile.ok ? (profile.fieldErrors.form ?? "个人资料读取失败") : "";
  const reminderRuleError = !reminderRules.ok ? (reminderRules.fieldErrors.form ?? "提醒规则读取失败") : "";
  const smtpConfigError = smtpConfig && !smtpConfig.ok ? (smtpConfig.fieldErrors.form ?? "SMTP 配置读取失败") : "";
  const trendThresholdError = !trendThresholds.ok ? (trendThresholds.fieldErrors.form ?? "趋势估算配置读取失败") : "";
  const initialProfileState = {
    values: profileToFormValues(profile.ok ? profile.data : null),
    fieldErrors: profile.ok ? {} : { form: profileError },
  };
  const initialRecipientEmailState = {
    values: {
      reminderEmail: initialProfileState.values.reminderEmail,
    },
    fieldErrors: profile.ok ? {} : { form: profileError },
  };
  const initialTrendThresholdState = {
    values: trendThresholdToFormValues(
      trendThresholds.ok ? trendThresholds.data : { minimumDays: 7, minimumRecords: 3 },
    ),
    fieldErrors: trendThresholds.ok ? {} : { form: trendThresholdError },
  };
  const initialReminderRuleState = {
    values: reminderRuleToFormValues(
      reminderRules.ok
        ? reminderRules.data
        : { reminderTime: "20:30", inAppEnabled: false, emailEnabled: false },
    ),
    fieldErrors: reminderRules.ok ? {} : { form: reminderRuleError },
  };
  const initialSmtpConfigState = {
    values: smtpConfigToFormValues(smtpConfig?.ok ? smtpConfig.data : null),
    fieldErrors: smtpConfig?.ok === false ? { form: smtpConfigError } : {},
  };
  const emailReminderStatus =
    latestEmailReminder.ok && latestEmailReminder.data
      ? `${latestEmailReminder.data.status === "sent" ? "发送成功" : latestEmailReminder.data.status === "failed" ? "发送失败" : latestEmailReminder.data.status === "skipped" ? "已跳过" : "已创建"}：${latestEmailReminder.data.message}`
      : "还没有邮件提醒记录";
  const trustedDeviceList = trustedDevices.ok ? trustedDevices.data : [];
  const managedUsers =
    userList?.ok === true
      ? userList.data.map((user) => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role === "admin" ? ("admin" as const) : ("user" as const),
          disabledAtIso: user.disabledAtIso,
        }))
      : [];
  const userListError = userList?.ok === false ? userList.error.message : "";

  return (
    <AppShell authMode={auth.mode}>
      <main className="workbench-main">
        <section className="workbench-hero">
          <p className="workbench-eyebrow">设置中心</p>
          <h1 className="workbench-title">配置中心</h1>
          <p className="workbench-description">
            个人资料、提醒、邮件、趋势估算和访问保护都拆成独立卡片，按需进入对应配置。
          </p>
        </section>

        <section aria-label="配置分组" className="workbench-grid workbench-grid--two">
          {settingGroups
            .filter((group) => isAdmin || group.title !== "SMTP 邮件")
            .filter((group) => isAdmin || group.title !== "用户管理")
            .map((group) => (
            <article className="workbench-card" key={group.title}>
              <div className="mb-3">
                <h2 className="workbench-card-title">{group.title}</h2>
                <p className="workbench-card-text">{group.description}</p>
              </div>
              {group.title === "个人资料" ? (
                <ProfileForm initialState={initialProfileState} />
              ) : group.title === "邮件接收" ? (
                <RecipientEmailForm initialState={initialRecipientEmailState} />
              ) : group.title === "提醒规则" ? (
                <ReminderRuleForm initialState={initialReminderRuleState} />
              ) : group.title === "SMTP 邮件" ? (
                <div className="grid gap-4">
                  <SmtpConfigForm
                    initialState={initialSmtpConfigState}
                    passwordConfigured={smtpConfig?.ok ? smtpConfig.data.passwordConfigured : false}
                  />
                  <div className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 py-3">
                    <p className="m-0 text-sm font-semibold text-[var(--ink-primary)]">最近邮件提醒状态</p>
                    <p className="m-0 mt-1 text-sm text-[var(--ink-secondary)]">{emailReminderStatus}</p>
                  </div>
                </div>
              ) : group.title === "用户管理" ? (
                <UserManagementPanel currentUserId={auth.userId} listError={userListError} users={managedUsers} />
              ) : group.title === "趋势估算" ? (
                <TrendThresholdForm initialState={initialTrendThresholdState} />
              ) : group.title === "访问保护" ? (
                <AccessProtectionPanel devices={trustedDeviceList} />
              ) : (
                <div className="grid gap-2">
                  {group.items.map((item) => (
                    <div
                      className="flex min-h-10 items-center justify-between rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 py-2 text-sm"
                      key={item}
                    >
                      <span className="text-[var(--ink-secondary)]">{item}</span>
                      <span className="font-semibold text-[var(--ink-primary)]">待配置</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
