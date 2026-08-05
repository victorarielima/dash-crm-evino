import { insiderEnv, InsiderError } from "../env";
import { hourOfEpoch, isoDay } from "../periods";
import { insiderFetch, num, pick } from "../http";
import type { CampaignRow, MetricSet } from "../types";
import { M, type ChannelAdapter } from "./base";

const BASE = "https://web-push.api.useinsider.com";
const PER_PAGE = 20; // máximo aceito pela API (25+ → 422)
const MAX_PAGES = 25; // teto de segurança (até 500 campanhas por consulta)

// "2026-05-11 19:30:00" (UTC) → hora 0–23 em America/Sao_Paulo. Ignora placeholders ("-").
function parseHour(v: unknown): number | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return undefined;
  const [, yyyy, mm, dd, hh, mi, ss] = m;
  const epochMs = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss);
  return hourOfEpoch(Math.floor(epochMs / 1000));
}

function rowMetrics(c: any): MetricSet {
  return {
    sent: num(c.sent),
    delivered: num(c.delivered),
    clicked: num(c.clicks),
    converted: num(c.conversions),
    revenue: num(c.revenue),
  };
}

// Memo curto (por intervalo) p/ o KPI e a lista de campanhas do mesmo período
// reaproveitarem uma única paginação (protege o rate limit de 30 req/min).
type Overall = { metrics: MetricSet; rows: CampaignRow[] };
const cache = new Map<string, { t: number; p: Promise<Overall> }>();
const TTL = 60_000;

async function fetchOverall(start: Date, end: Date): Promise<Overall> {
  const partnerId = insiderEnv.webpushPartnerId();
  if (!partnerId) throw new InsiderError("INSIDER_WEBPUSH_PARTNER_ID não configurado.");
  const key = `${start.getTime()}-${end.getTime()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.p;

  const p = (async (): Promise<Overall> => {
    const all: any[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const json = await insiderFetch(`${BASE}/v1/statistics/overall-metrics`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${insiderEnv.webpushKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          partner_id: partnerId, // string!
          start_date: isoDay(start),
          end_date: isoDay(end),
          page,
          per_page: PER_PAGE,
        }),
      });
      const data = (pick(json, "data") as any[]) || [];
      all.push(...data);
      const total = num(pick(json, "total"));
      if (data.length < PER_PAGE || (total && all.length >= total)) break;
    }

    const metrics: MetricSet = { sent: 0, delivered: 0, clicked: 0, converted: 0, revenue: 0 };
    const rows: CampaignRow[] = all.map((c) => {
      const m = rowMetrics(c);
      metrics.sent! += m.sent ?? 0;
      metrics.delivered! += m.delivered ?? 0;
      metrics.clicked! += m.clicked ?? 0;
      metrics.converted! += m.converted ?? 0;
      metrics.revenue! += m.revenue ?? 0;
      const send = typeof c.sendDate === "string" && c.sendDate !== "-" ? c.sendDate : c.startDate;
      return {
        name: String(c.campName || c.id),
        status: c.statusName || c.type,
        hour: parseHour(send),
        metrics: m,
      };
    });
    return { metrics, rows };
  })();

  cache.set(key, { t: Date.now(), p });
  return p;
}

// Auth: Authorization: Bearer <chave> + partner_id como STRING.
export const webpushAdapter: ChannelAdapter = {
  id: "webpush",
  label: "Web Push",
  metrics: [M.sent, M.delivered, M.clicked, M.converted, M.revenue, M.bottles],
  primary: "revenue",
  supportsHistory: true,
  note: "Rate limit de 30 req/min: períodos longos são agregados por semana.",
  async fetchRange(start, end): Promise<MetricSet> {
    return (await fetchOverall(start, end)).metrics;
  },
  async fetchCampaigns(start, end): Promise<CampaignRow[]> {
    return (await fetchOverall(start, end)).rows;
  },
};
