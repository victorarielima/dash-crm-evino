// Monta as linhas do Web Push no layout EXATO da aba `insider_WebPush` (23 col),
// a partir de /v1/statistics/overall-metrics (por campanha, paginado).
// Colunas: A Campaign | B Campaign Type | C Source | D Targeted | E Sent
//  F Dropped | G Delivered | H Undelivered | I Delivery Rate(frac) | J Clicks
//  K CTR(frac) | L Conversion | M Conversion Rate(frac) | N Revenue
//  O Start Date | P End Date | Q Status | R Tags | S Groups | T Variant ID
//  U Message Link | V First Button Link | W Second Button Link
import { insiderEnv } from "@/lib/insider/env";
import { insiderFetch, num } from "@/lib/insider/http";
import { isoDay } from "@/lib/insider/periods";
import type { BrandId } from "@/lib/insider/types";

const URL = "https://web-push.api.useinsider.com/v1/statistics/overall-metrics";
const PER_PAGE = 20; // endpoint exige entre 10 e 20
const MAX_PAGES = 60;

type Cell = string | number;

// "2026-05-11 19:30:00" → serial do Sheets (sem conversão de fuso — a aba de
// Web Push guarda o horário como vem da API).
function serial(v: unknown): Cell {
  const m = String(v ?? "").match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return "";
  const [, Y, Mo, D, h, mi, s] = m;
  return Date.UTC(+Y, +Mo - 1, +D, +h, +mi, +s) / 86400000 + 25569;
}
const cap = (s: unknown) => {
  const t = String(s ?? "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
};
const list = (a: unknown) => (Array.isArray(a) ? a.join(", ") : String(a ?? ""));

export async function buildWebpushRows(brand: BrandId, start: Date, end: Date): Promise<Cell[][]> {
  const headers = { Authorization: `Bearer ${insiderEnv.webpushKey(brand)}`, "Content-Type": "application/json" };
  const partner = insiderEnv.webpushPartnerId(brand);
  const camps: any[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const json = await insiderFetch(URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        partner_id: partner,
        start_date: isoDay(start),
        end_date: isoDay(end),
        page,
        per_page: PER_PAGE,
      }),
    });
    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    camps.push(...data);
    const total = num(json?.total);
    if (!data.length || camps.length >= total || page * PER_PAGE >= total) break;
  }

  return camps
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
    .map((c): Cell[] => [
      String(c.campName ?? c.id ?? ""), // A
      String(c.type ?? ""), // B
      "Web Push", // C
      num(c.targeted), // D
      num(c.sent), // E
      num(c.dropped), // F
      num(c.delivered), // G
      num(c.undelivered), // H
      num(c.deliveryRate), // I (fração)
      num(c.clicks), // J
      num(c.ctr), // K (fração)
      num(c.conversions), // L
      num(c.conversionRate), // M (fração)
      num(c.revenue), // N
      serial(c.startDate), // O
      serial(c.endDate), // P
      cap(c.statusName), // Q
      list(c.tags), // R
      list(c.groupLevels), // S
      "", // T Variant ID (não exposto no overall-metrics)
      String(c.messageLink ?? ""), // U
      String(c.firstButtonLink ?? ""), // V
      String(c.secondButtonLink ?? ""), // W
    ]);
}
