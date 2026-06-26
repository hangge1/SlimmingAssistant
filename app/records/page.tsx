import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { requireTrustedDevice } from "@/features/access/services/route-guards";
import { createRecordsRepository } from "@/features/records/repositories/records-repository";
import { HealthRecordForm } from "@/features/records/components/health-record-form";
import { RunRecordForm } from "@/features/records/components/run-record-form";
import { healthRecordToFormValues } from "@/features/records/actions/health-record-form-state";
import { initialRunRecordFormState } from "@/features/records/actions/run-record-form-state";
import { getHealthRecordByDate, listRunRecordsByDate, validateLocalDate } from "@/features/records/services/records-service";
import { getTodayLocalDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

type RecordsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
  await requireTrustedDevice();

  const params = (await searchParams) ?? {};
  const todayLocalDate = getTodayLocalDate();
  const requestedDate = getStringParam(params, "date") ?? todayLocalDate;
  const dateValidation = validateLocalDate(requestedDate);
  const localDate = dateValidation.ok ? requestedDate : todayLocalDate;
  const repository = createRecordsRepository();
  const healthRecord = getHealthRecordByDate(repository, localDate);
  const runRecords = listRunRecordsByDate(repository, localDate);
  const healthRecordError =
    !healthRecord.ok && "error" in healthRecord ? healthRecord.error.message : "记录数据读取失败";
  const initialState = {
    values: healthRecordToFormValues(healthRecord.ok ? healthRecord.data : null),
    fieldErrors: healthRecord.ok ? {} : { form: healthRecordError },
  };
  const todayRuns = runRecords.ok ? runRecords.data : [];

  return (
    <AppShell>
      <main className="page-main">
        <div className="grid gap-4">
          <section className="flex flex-col gap-4 rounded-md border border-[var(--border-soft)] bg-[var(--surface-panel)] p-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="m-0 text-[28px] font-semibold leading-tight text-[var(--ink-primary)]">
                提交记录
              </h1>
              <p className="m-0 mt-1 text-sm text-[var(--ink-secondary)]">
                {localDate === todayLocalDate ? "今天" : "补录"}：{localDate}
              </p>
            </div>
            <form action="/records" className="grid gap-2 sm:grid-cols-[220px_auto] sm:items-end" method="get">
              <div className="grid gap-2">
                <label htmlFor="recordDate" className="text-sm font-semibold text-[var(--ink-primary)]">
                  记录日期
                </label>
                <input
                  className="min-h-11 rounded-md border border-[var(--border-soft)] bg-white px-3 text-sm text-[var(--ink-primary)]"
                  defaultValue={localDate}
                  id="recordDate"
                  name="date"
                  type="date"
                />
              </div>
              <Button type="submit" variant="secondary">
                切换日期
              </Button>
            </form>
          </section>

          {dateValidation.ok ? null : (
            <p className="m-0 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
              日期参数无效，已切换为今天
            </p>
          )}

          <section aria-label="记录表单" className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
            <article className="card p-4">
              <div className="mb-4">
                <h2 className="m-0 text-lg font-semibold text-[var(--ink-primary)]">健康记录</h2>
                <p className="m-0 mt-1 text-sm text-[var(--ink-secondary)]">
                  提交体重、围度和体脂率；同一天重复提交会覆盖当天健康记录。
                </p>
              </div>
              <HealthRecordForm initialState={initialState} localDate={localDate} />
            </article>

            <article className="card p-4">
              <div className="mb-4">
                <h2 className="m-0 text-lg font-semibold text-[var(--ink-primary)]">跑步记录</h2>
                <p className="m-0 mt-1 text-sm text-[var(--ink-secondary)]">
                  提交一次跑步数据；同一天可以保存多条跑步记录。
                </p>
              </div>
              <RunRecordForm initialState={initialRunRecordFormState} localDate={localDate} />

              <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
                <p className="mb-3 text-sm font-semibold text-[var(--ink-primary)]">
                  {localDate === todayLocalDate ? "今日跑步记录" : "当日跑步记录"}
                </p>
                {todayRuns.length > 0 ? (
                  <div className="grid gap-2">
                    {todayRuns.map((record) => (
                      <div
                        className="grid gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface-subtle)] px-3 py-2 text-sm sm:grid-cols-4"
                        key={record.id}
                      >
                        <span>{record.distanceKm} 公里</span>
                        <span>{record.durationSeconds == null ? "时长未填" : `${Math.round(record.durationSeconds / 60)} 分钟`}</span>
                        <span>{record.paceSecondsPerKm == null ? "配速未填" : `${Math.round((record.paceSecondsPerKm / 60) * 10) / 10} 分钟/公里`}</span>
                        <span>{record.averageHeartRateBpm == null ? "心率未填" : `${record.averageHeartRateBpm} 次/分`}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="m-0 text-sm text-[var(--ink-secondary)]">当前日期还没有跑步记录</p>
                )}
              </div>
            </article>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
