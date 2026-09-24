import { NextResponse } from "next/server";
import { resolveRange } from "@/lib/insider/periods";
import { appendRows, setCell, serviceAccountEmail } from "@/lib/sheets";
import { CHANNEL_EXPORTS, EXPORT_ORDER } from "@/lib/export/registry";
import type { BrandId, PeriodId } from "@/lib/insider/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function todayBR(): string {
  const d = new Date(Date.now() - 3 * 3600 * 1000); // BR (UTC-3)
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

interface ChannelResult {
  channel: string;
  tab: string;
  ok: boolean;
  appended?: number;
  error?: string;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  const brand = body?.brand as BrandId;
  // Sempre "este ano" (o botão manda "year"); resolveRange trata o intervalo.
  const period = (body?.period as PeriodId) || "year";
  const range = resolveRange(period, body?.start, body?.end);

  const results: ChannelResult[] = [];
  for (const channel of EXPORT_ORDER) {
    const def = CHANNEL_EXPORTS[channel];
    if (!def.build) {
      results.push({ channel, tab: def.tab, ok: false, error: def.reason });
      continue;
    }
    try {
      const rows = await def.build(brand, range.start, range.end);
      const appended = rows.length ? await appendRows(def.tab, rows) : 0;
      if (appended && def.dateCell) {
        try {
          await setCell(`${def.tab}!${def.dateCell}`, todayBR());
        } catch {
          /* não crítico */
        }
      }
      results.push({ channel, tab: def.tab, ok: true, appended });
    } catch (e: any) {
      results.push({ channel, tab: def.tab, ok: false, error: e?.message || "Falha ao exportar." });
    }
  }

  const anyWritten = results.some((r) => r.ok && (r.appended ?? 0) > 0);
  return NextResponse.json({
    ok: anyWritten,
    period,
    serviceAccount: serviceAccountEmail(),
    results,
  });
}
