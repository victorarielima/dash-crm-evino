import { NextResponse } from "next/server";
import { runQuery } from "@/lib/insider";
import type { ChannelId, PeriodId } from "@/lib/insider/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CHANNELS: ChannelId[] = ["email", "sms", "whatsapp", "webpush", "apppush"];
const PERIODS: PeriodId[] = ["year", "30d", "15d", "7d", "2d", "today", "custom"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel") as ChannelId | null;
  const period = searchParams.get("period") as PeriodId | null;
  const start = searchParams.get("start") || undefined;
  const end = searchParams.get("end") || undefined;

  if (!channel || !CHANNELS.includes(channel)) {
    return NextResponse.json({ ok: false, error: "Canal inválido." }, { status: 400 });
  }
  if (!period || !PERIODS.includes(period)) {
    return NextResponse.json({ ok: false, error: "Período inválido." }, { status: 400 });
  }

  try {
    const result = await runQuery(channel, period, start, end);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Erro inesperado ao consultar a Insider." },
      { status: 500 },
    );
  }
}
