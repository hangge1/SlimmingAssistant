import { NextResponse } from "next/server";
import { runReminderChecksForActiveUsers } from "@/features/reminders/services/reminder-scheduler";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = process.env.INTERNAL_REMINDER_TOKEN;
  const requestToken = request.headers.get("x-internal-reminder-token");

  if (!token || requestToken !== token) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const result = await runReminderChecksForActiveUsers();

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
