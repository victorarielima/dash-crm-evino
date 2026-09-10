import { NextResponse } from "next/server";
import { runCampaignDetail } from "@/lib/insider";
import { DEFAULT_BRAND, isBrandId } from "@/lib/brands";
import type { ChannelId, PeriodId } from "@/lib/insider/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CHANNELS: ChannelId[] = ["email", "sms", "whatsapp", "webpush", "apppush"];
const PERIODS: PeriodId[] = ["year", "30d", "15d", "7d", "2d", "today", "custom"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brandParam = searchParams.get("brand");
  const channel = searchParams.get("channel") as ChannelId | null;
  const period = searchParams.get("period") as PeriodId | null;
  const campaignId = searchParams.get("id") || undefined;
  const name = searchParams.get("name") || undefined;
  const status = searchParams.get("status") || undefined;
  const hourRaw = searchParams.get("hour");
  const hourNum = hourRaw != null ? Number(hourRaw) : NaN;
  const hour = Number.isInteger(hourNum) && hourNum >= 0 && hourNum <= 23 ? hourNum : undefined;
  const start = searchParams.get("start") || undefined;
  const end = searchParams.get("end") || undefined;

  if (brandParam !== null && !isBrandId(brandParam)) {
    return NextResponse.json({ ok: false, error: "Conta inválida." }, { status: 400 });
  }
  const brand = isBrandId(brandParam) ? brandParam : DEFAULT_BRAND;

  if (!channel || !CHANNELS.includes(channel)) {
    return NextResponse.json({ ok: false, error: "Canal inválido." }, { status: 400 });
  }
  if (!period || !PERIODS.includes(period)) {
    return NextResponse.json({ ok: false, error: "Período inválido." }, { status: 400 });
  }
  if (!campaignId && !name) {
    return NextResponse.json({ ok: false, error: "Informe o id ou o nome da campanha." }, { status: 400 });
  }

  try {
    const result = await runCampaignDetail(brand, channel, {
      campaignId,
      name,
      status,
      hour,
      period,
      customStart: start,
      customEnd: end,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Erro inesperado ao detalhar a campanha." },
      { status: 500 },
    );
  }
}
