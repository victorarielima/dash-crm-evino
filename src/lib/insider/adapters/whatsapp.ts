import { insiderEnv } from "../env";
import { epochSec, hourOfEpoch } from "../periods";
import { insiderFetch, num, pick } from "../http";
import type { BrandId, CampaignRow, MetricSet } from "../types";
import { M, type ChannelAdapter } from "./base";

const BASE = "https://whatsapp.useinsider.com";

function metricsFrom(o: any): MetricSet {
  return {
    sent: num(o.sent),
    delivered: num(o.delivered),
    clicked: num(o.click),
    converted: num(o.conversion),
    revenue: num(o.revenue),
  };
}

// Memo curto (por intervalo) p/ o KPI e a lista de campanhas do mesmo período
// reaproveitarem uma única chamada.
type Overall = { metrics: MetricSet; rows: CampaignRow[] };
const cache = new Map<string, { t: number; p: Promise<Overall> }>();
const TTL = 60_000;

async function fetchOverall(brand: BrandId, start: Date, end: Date): Promise<Overall> {
  const key = `${brand}-${start.getTime()}-${end.getTime()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.p;

  const p = (async (): Promise<Overall> => {
    // campaign_filter é opcional; omitido = todas as campanhas, SEM jornadas
    // (show_architect default false).
    const json = await insiderFetch(`${BASE}/v1/statistics/overall`, {
      method: "POST",
      headers: { "x-ins-auth-key": insiderEnv.whatsappKey(brand), "Content-Type": "application/json" },
      body: JSON.stringify({ start_time: epochSec(start), end_time: epochSec(end) }),
    });

    const summary = (pick(json, "summary") as any) || {};
    const details = (pick(json, "details") as any[]) || [];
    const rows: CampaignRow[] = details.map((c) => ({
      id: c.id != null ? String(c.id) : undefined,
      name: String(c.campName || c.id),
      status: c.status,
      hour: typeof c.startsOn === "number" ? hourOfEpoch(c.startsOn) : undefined,
      metrics: metricsFrom(c),
    }));
    rows.sort((a, b) => (b.metrics.revenue ?? 0) - (a.metrics.revenue ?? 0));
    return { metrics: metricsFrom(summary), rows };
  })();

  cache.set(key, { t: Date.now(), p });
  return p;
}

// WhatsApp: endpoint dedicado de campanhas (não Architect/jornadas).
export const whatsappAdapter: ChannelAdapter = {
  id: "whatsapp",
  label: "WhatsApp",
  metrics: [M.sent, M.delivered, M.clicked, M.converted, M.revenue, M.bottles],
  primary: "revenue",
  supportsHistory: true,
  async fetchRange(brand, start, end): Promise<MetricSet> {
    return (await fetchOverall(brand, start, end)).metrics;
  },
  async fetchCampaigns(brand, start, end): Promise<CampaignRow[]> {
    return (await fetchOverall(brand, start, end)).rows;
  },
};
