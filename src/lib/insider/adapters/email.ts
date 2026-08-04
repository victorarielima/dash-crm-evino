import { insiderEnv } from "../env";
import { epochSec, hourOfEpoch } from "../periods";
import { pool } from "../pool";
import { insiderFetch, num, pick } from "../http";
import type { CampaignRow, MetricSet } from "../types";
import { M, type ChannelAdapter } from "./base";

const BASE = "https://analytics.api.useinsider.com";
const MAX_PAGES = 6; // páginas de 100 → até 600 campanhas varridas
const MAX_CAMPAIGNS = 50; // teto de chamadas de statistics por consulta

function summaryToMetrics(s: any): MetricSet {
  return {
    sent: num(s.sent),
    delivered: num(s.delivered),
    opened: num(pick(s, "uniqueOpens", "totalOpens")),
    clicked: num(pick(s, "uniqueClicks", "totalClicks")),
    converted: num(s.conversions),
    revenue: num(s.revenue),
    unsubscribed: num(pick(s, "unsubscribe", "unsubscribes")),
    bounced: num(s.bounce),
  };
}

// "04-08-2026 13:00:03" está em UTC → converte a hora p/ America/Sao_Paulo.
function parseLaunch(v: unknown): { date: Date; hour: number } | null {
  if (typeof v !== "string") return null;
  const m = v.match(/(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  const epochMs = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss);
  return { date: new Date(epochMs), hour: hourOfEpoch(Math.floor(epochMs / 1000)) };
}

export const emailAdapter: ChannelAdapter = {
  id: "email",
  label: "Email",
  metrics: [M.sent, M.delivered, M.opened, M.clicked, M.converted, M.revenue, M.bottles, M.unsubscribed, M.bounced],
  primary: "revenue",
  supportsHistory: true,
  async fetchRange(start, end): Promise<MetricSet> {
    const url = `${BASE}/email/v2/overall?startTime=${epochSec(start)}&endTime=${epochSec(end)}`;
    const json = await insiderFetch(url, { headers: { "X-INS-AUTH-KEY": insiderEnv.emailKey() } });
    const s = pick(json, "data.summary", "summary") as any;
    return s ? summaryToMetrics(s) : {};
  },
  async fetchCampaigns(start, end): Promise<CampaignRow[]> {
    const key = insiderEnv.emailKey();
    const inRange: { id: number; name: string; type?: string; launch: Date; hour: number }[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${BASE}/email/v2/campaign/list?page=${page}&perPage=100`;
      const json = await insiderFetch(url, { headers: { "X-INS-AUTH-KEY": key } });
      const rows: any[] = (pick(json, "data") as any[]) || [];
      if (!rows.length) break;
      let allOlder = true;
      for (const c of rows) {
        const parsed = parseLaunch(c.startTime);
        if (!parsed) continue;
        const launch = parsed.date;
        if (launch >= start && launch <= end) {
          inRange.push({ id: num(c.id), name: String(c.name || c.id), type: c.type, launch, hour: parsed.hour });
        }
        if (launch >= start) allOlder = false;
      }
      // lista é mais-nova→mais-antiga: se a página toda já é anterior ao início, para.
      if (allOlder) break;
      const last = num(pick(json, "lastPage"));
      if (last && page >= last) break;
    }

    inRange.sort((a, b) => b.launch.getTime() - a.launch.getTime());
    const capped = inRange.slice(0, MAX_CAMPAIGNS);

    const startEpoch = epochSec(start);
    const rows = await pool(capped, 4, async (c) => {
      try {
        // startTime = início do período (janela ampla o bastante p/ a campanha ter dados)
        const url = `${BASE}/email/v2/campaign/statistics?campaignId=${c.id}&startTime=${startEpoch}`;
        const json = await insiderFetch(url, { headers: { "X-INS-AUTH-KEY": key } });
        const s = pick(json, "data.summary", "summary", "data") as any;
        return { name: c.name, status: c.type, hour: c.hour, metrics: s ? summaryToMetrics(s) : {} } as CampaignRow;
      } catch {
        return { name: c.name, status: c.type, hour: c.hour, metrics: {} } as CampaignRow;
      }
    });
    return rows;
  },
};
