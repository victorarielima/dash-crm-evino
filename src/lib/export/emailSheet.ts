// Monta as linhas do Email no layout EXATO da aba `insider_News` (28 colunas).
// Cabeçalho (row 2) da planilha CRM:
//  A Campaign Name | B Sent date & time (local) | C Time Zone | D Subject
//  E Campaign Type | F Campaign Tag | G Campaign ID | H Campaign Sender Domain
//  I UTM Parameters | J Sent | K Delivered | L Total Opens | M Unique Open
//  N Unique User Opens(%) | O Unique MPP Open(%) | P Open Rate(%)
//  Q Total Clicks | R Unique Clicks | S Click-Through Rate(%) | T Click to Open Rate(%)
//  U Conversion | V Conversion Rate(%) | W Revenue | X Unsubscribes | Y Bounces
//  Z Blocks | AA Spam Reports | AB Invalid Emails
import { insiderEnv } from "@/lib/insider/env";
import { insiderFetch, num, pick } from "@/lib/insider/http";
import { epochSec } from "@/lib/insider/periods";
import { pool } from "@/lib/insider/pool";
import type { BrandId } from "@/lib/insider/types";

const BASE = "https://analytics.api.useinsider.com";
const MAX_PAGES = 10; // até 1000 campanhas varridas
const MAX_CAMPAIGNS = 500; // teto de chamadas de statistics (period longo → mais recentes)

type Cell = string | number;

interface Meta {
  id: number;
  name: string;
  subject: string;
  type: string;
  tag: string;
  senderDomain: string;
  utm: string;
  startUtc: string;
  launch: Date;
}

// "04-08-2026 13:00:03" (UTC) → serial de data do Sheets em horário local (BR, UTC-3).
function serialSP(v: string): Cell {
  const m = v?.match?.(/(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return "";
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  const utcMs = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss);
  const spMs = utcMs - 3 * 3600 * 1000; // Brasil = UTC-3 fixo
  return spMs / 86400000 + 25569; // dias desde 1899-12-30
}
function launchDate(v: string): Date | null {
  const m = v?.match?.(/(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  return new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss));
}
// rate numérico da Insider (ex.: 24.1449) → texto "24.14%" (como na planilha).
function pct(v: unknown): string {
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toFixed(2) + "%";
}
function money(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
// utmParameters (objeto) → "utm_source:insider, utm_medium:email, ..." na ordem canônica.
function utm(o: any): string {
  if (!o || typeof o !== "object") return typeof o === "string" ? o : "";
  const order = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_status"];
  const keys = [...order.filter((k) => k in o), ...Object.keys(o).filter((k) => !order.includes(k))];
  return keys.map((k) => `${k}:${o[k] ?? ""}`).join(", ");
}

export async function buildEmailRows(brand: BrandId, start: Date, end: Date): Promise<Cell[][]> {
  const keyAuth = insiderEnv.emailKey(brand);
  const meta: Meta[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${BASE}/email/v2/campaign/list?page=${page}&perPage=100`;
    const json = await insiderFetch(url, { headers: { "X-INS-AUTH-KEY": keyAuth } });
    const rows: any[] = (pick(json, "data") as any[]) || [];
    if (!rows.length) break;
    let allOlder = true;
    for (const c of rows) {
      const launch = launchDate(c.startTime);
      if (!launch) continue;
      if (launch >= start && launch <= end) {
        meta.push({
          id: num(c.id),
          name: String(c.name ?? c.id),
          subject: String(c.subject ?? ""),
          type: String(c.type ?? ""),
          tag: Array.isArray(c.tags) ? c.tags.join(", ") : String(c.tags ?? c.tag ?? ""),
          senderDomain: String(c.senderDomain ?? ""),
          utm: utm(c.utmParameters),
          startUtc: String(c.startTime ?? ""),
          launch,
        });
      }
      if (launch >= start) allOlder = false;
    }
    if (allOlder) break;
    const last = num(pick(json, "lastPage"));
    if (last && page >= last) break;
  }

  // pega as MAIS RECENTES (teto), depois volta a cronológico p/ a planilha
  meta.sort((a, b) => b.launch.getTime() - a.launch.getTime());
  const capped = meta.slice(0, MAX_CAMPAIGNS).sort((a, b) => a.launch.getTime() - b.launch.getTime());
  const startEpoch = epochSec(start);

  const rows = await pool(capped, 4, async (c): Promise<Cell[]> => {
    let s: any = {};
    try {
      const url = `${BASE}/email/v2/campaign/statistics?campaignId=${c.id}&startTime=${startEpoch}`;
      const json = await insiderFetch(url, { headers: { "X-INS-AUTH-KEY": keyAuth } });
      s = (pick(json, "data.summary", "summary", "data") as any) || {};
    } catch {
      s = {};
    }
    return [
      c.name, // A
      serialSP(c.startUtc), // B
      "America/Sao_Paulo", // C
      c.subject, // D
      c.type, // E
      c.tag, // F
      c.id, // G
      c.senderDomain, // H
      c.utm, // I
      num(s.sent), // J
      num(s.delivered), // K
      num(pick(s, "totalOpens", "totalOpen")), // L
      num(pick(s, "uniqueOpens", "uniqueOpen")), // M
      pct(pick(s, "uniqueUserOpenRate")), // N
      pct(pick(s, "uniqueMachineOpenRate")), // O
      pct(pick(s, "openRate")), // P
      num(pick(s, "totalClicks", "totalClick")), // Q
      num(pick(s, "uniqueClicks", "uniqueClick")), // R
      pct(pick(s, "clickThroughRate")), // S
      pct(pick(s, "clickToOpenRate")), // T
      num(s.conversions), // U
      pct(pick(s, "conversionRate")), // V
      money(s.revenue), // W
      num(pick(s, "unsubscribe", "unsubscribes")), // X
      num(s.bounce), // Y
      num(pick(s, "blocks", "block")), // Z
      num(pick(s, "spamReports", "spams")), // AA
      num(pick(s, "invalid", "invalidDrop", "invalidEmails")), // AB
    ];
  });

  return rows;
}
