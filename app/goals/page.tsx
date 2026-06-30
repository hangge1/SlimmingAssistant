import { AppShell } from "@/components/layout/app-shell";
import { GoalSettingsSection } from "@/features/goals/components/goal-settings-section";
import { requireTrustedDevice } from "@/features/access/services/route-guards";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  await requireTrustedDevice();

  return (
    <AppShell>
      <main className="page-main">
        <GoalSettingsSection />
      </main>
    </AppShell>
  );
}
