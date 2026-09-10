import { insiderEnv } from "../env";
import { epochSec, hourOfEpoch } from "../periods";
import { pool } from "../pool";
import { insiderFetch, num, pick } from "../http";
import type { BrandId, CampaignRow, IspRow, MetricSet } from "../types";
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
    blocked: num(pick(s, "blocks", "block")),
    spam: num(pick(s, "spamReports", "spams", "spam")),
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

// Acumulador de métricas de um provedor (ISP).
interface IspAcc {
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  bounced: number;
  blocked: number;
  spam: number;
}
const zeroIsp = (): IspAcc => ({ delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, bounced: 0, blocked: 0, spam: 0 });

// Memo curto (por intervalo): campanhas e ISP saem da mesma varredura de statistics.
type EmailAll = { rows: CampaignRow[]; isp: IspRow[] };
const cache = new Map<string, { t: number; p: Promise<EmailAll> }>();
const TTL = 60_000;

async function fetchAll(brand: BrandId, start: Date, end: Date): Promise<EmailAll> {
  const key = `${brand}-${start.getTime()}-${end.getTime()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.p;

  const p = (async (): Promise<EmailAll> => {
    const keyAuth = insiderEnv.emailKey(brand);
    const inRange: { id: number; name: string; type?: string; launch: Date; hour: number }[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${BASE}/email/v2/campaign/list?page=${page}&perPage=100`;
      const json = await insiderFetch(url, { headers: { "X-INS-AUTH-KEY": keyAuth } });
      const listRows: any[] = (pick(json, "data") as any[]) || [];
      if (!listRows.length) break;
      let allOlder = true;
      for (const c of listRows) {
        const parsed = parseLaunch(c.startTime);
        if (!parsed) continue;
        const launch = parsed.date;
        if (launch >= start && launch <= end) {
          inRange.push({ id: num(c.id), name: String(c.name || c.id), type: c.type, launch, hour: parsed.hour });
        }
        if (launch >= start) allOlder = false;
      }
      if (allOlder) break;
      const last = num(pick(json, "lastPage"));
      if (last && page >= last) break;
    }

    inRange.sort((a, b) => b.launch.getTime() - a.launch.getTime());
    const capped = inRange.slice(0, MAX_CAMPAIGNS);
    const startEpoch = epochSec(start);

    const perCampaign = await pool(capped, 4, async (c) => {
      try {
        const url = `${BASE}/email/v2/campaign/statistics?campaignId=${c.id}&startTime=${startEpoch}`;
        const json = await insiderFetch(url, { headers: { "X-INS-AUTH-KEY": keyAuth } });
        const s = pick(json, "data.summary", "summary", "data") as any;
        const isp = ((pick(json, "data.isp", "isp") as any[]) || []) as any[];
        return {
          row: { name: c.name, status: c.type, hour: c.hour, metrics: s ? summaryToMetrics(s) : {} } as CampaignRow,
          isp,
        };
      } catch {
        return { row: { name: c.name, status: c.type, hour: c.hour, metrics: {} } as CampaignRow, isp: [] as any[] };
      }
    });

    // agrega o ISP de todas as campanhas do período
    const acc = new Map<string, IspAcc>();
    for (const pc of perCampaign) {
      for (const prov of pc.isp) {
        const name = String(prov?.name || "").toLowerCase();
        if (!name) continue;
        const m = prov.metrics || {};
        const a = acc.get(name) || zeroIsp();
        a.delivered += num(m.delivered);
        a.opened += num(pick(m, "uniqueOpen", "totalOpen"));
        a.clicked += num(pick(m, "uniqueClick", "totalClick"));
        a.unsubscribed += num(m.unsubscribes);
        a.bounced += num(m.bounces);
        a.blocked += num(m.blocks);
        a.spam += num(m.spams);
        acc.set(name, a);
      }
    }
    const isp: IspRow[] = [...acc.entries()]
      .map(([name, a]) => ({
        name,
        metrics: {
          // sem "sent" por ISP → derivado: entregues + bounces + bloqueios
          sent: a.delivered + a.bounced + a.blocked,
          delivered: a.delivered,
          opened: a.opened,
          clicked: a.clicked,
          unsubscribed: a.unsubscribed,
          bounced: a.bounced,
          blocked: a.blocked,
          spam: a.spam,
        } as MetricSet,
      }))
      .sort((x, y) => (y.metrics.sent ?? 0) - (x.metrics.sent ?? 0));

    return { rows: perCampaign.map((pc) => pc.row), isp };
  })();

  cache.set(key, { t: Date.now(), p });
  return p;
}

export const emailAdapter: ChannelAdapter = {
  id: "email",
  label: "Email",
  metrics: [M.sent, M.delivered, M.opened, M.clicked, M.converted, M.revenue, M.bottles, M.unsubscribed, M.bounced, M.blocked, M.spam],
  primary: "revenue",
  supportsHistory: true,
  async fetchRange(brand, start, end): Promise<MetricSet> {
    const url = `${BASE}/email/v2/overall?startTime=${epochSec(start)}&endTime=${epochSec(end)}`;
    const json = await insiderFetch(url, { headers: { "X-INS-AUTH-KEY": insiderEnv.emailKey(brand) } });
    const s = pick(json, "data.summary", "summary") as any;
    return s ? summaryToMetrics(s) : {};
  },
  async fetchCampaigns(brand, start, end): Promise<CampaignRow[]> {
    return (await fetchAll(brand, start, end)).rows;
  },
  async fetchIsp(brand, start, end): Promise<IspRow[]> {
    return (await fetchAll(brand, start, end)).isp;
  },
};
