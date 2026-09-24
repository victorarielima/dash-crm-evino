import { NextResponse } from "next/server";
import { resolveRange } from "@/lib/insider/periods";
import { buildEmailRows } from "@/lib/export/emailSheet";
import { appendRows, setCell, serviceAccountEmail } from "@/lib/sheets";
import type { BrandId, ChannelId, PeriodId } from "@/lib/insider/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Aba de destino por canal na planilha CRM (só Email por enquanto).
const TAB: Partial<Record<ChannelId, string>> = { email: "insider_News" };

function todayBR(): string {
  const d = new Date(Date.now() - 3 * 3600 * 1000); // BR (UTC-3)
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  const brand = body?.brand as BrandId;
  const channel = body?.channel as ChannelId;
  const period = body?.period as PeriodId;
  const tab = TAB[channel];

  if (!tab) {
    return NextResponse.json(
      { ok: false, error: "Exportação disponível para o canal Email por enquanto — os demais canais entram em breve." },
      { status: 400 },
    );
  }

  try {
    const range = resolveRange(period, body?.start, body?.end);
    const rows = await buildEmailRows(brand, range.start, range.end);
    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "Nenhuma campanha no período para exportar." }, { status: 200 });
    }
    const appended = await appendRows(tab, rows);
    // atualiza o "DATA DA ÚLTIMA ATUALIZAÇÃO" no topo da aba (C1)
    try {
      await setCell(`${tab}!C1`, todayBR());
    } catch {
      /* não crítico */
    }
    return NextResponse.json({ ok: true, appended, tab });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || `Falha ao exportar. Verifique o acesso do service account ${serviceAccountEmail()}.` },
      { status: 500 },
    );
  }
}
