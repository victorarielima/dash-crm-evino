import { insiderEnv } from "../env";
import { epochSec, hourOfEpoch } from "../periods";
import { pool } from "../pool";
import { insiderFetch, num, pick } from "../http";
import type { BrandId, CampaignRow, DropRow, IspRow, LinkClick, MetricSet } from "../types";
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

// Memo curto (por marca+intervalo) da varredura de campanhas.
const cache = new Map<string, { t: number; p: Promise<CampaignRow[]> }>();
const TTL = 60_000;

async function fetchAll(brand: BrandId, start: Date, end: Date): Promise<CampaignRow[]> {
  const key = `${brand}-${start.getTime()}-${end.getTime()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.p;

  const p = (async (): Promise<CampaignRow[]> => {
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

    return pool(capped, 4, async (c) => {
      try {
        const url = `${BASE}/email/v2/campaign/statistics?campaignId=${c.id}&startTime=${startEpoch}`;
        const json = await insiderFetch(url, { headers: { "X-INS-AUTH-KEY": keyAuth } });
        const s = pick(json, "data.summary", "summary", "data") as any;
        return {
          id: String(c.id),
          name: c.name,
          status: c.type,
          hour: c.hour,
          metrics: s ? summaryToMetrics(s) : {},
        } as CampaignRow;
      } catch {
        return { id: String(c.id), name: c.name, status: c.type, hour: c.hour, metrics: {} } as CampaignRow;
      }
    });
  })();

  cache.set(key, { t: Date.now(), p });
  return p;
}

// ── Detalhe de UMA campanha ────────────────────────────────────────────────
// GET /email/v2/campaign/statistics?campaignId=&startTime=&endTime=
// devolve data.summary (métricas + drops + linkClickActivity) e data.isp.

const ISP_ZERO = () => ({ delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, bounced: 0, blocked: 0, spam: 0 });

function ispRows(raw: any[]): IspRow[] {
  return raw
    .map((prov) => {
      const m = prov?.metrics || {};
      const a = ISP_ZERO();
      a.delivered = num(m.delivered);
      a.opened = num(pick(m, "uniqueOpen", "totalOpen"));
      a.clicked = num(pick(m, "uniqueClick", "totalClick"));
      a.unsubscribed = num(pick(m, "unsubscribes", "unsubscribe"));
      a.bounced = num(pick(m, "bounces", "bounce"));
      a.blocked = num(pick(m, "blocks", "block"));
      a.spam = num(pick(m, "spams", "spamReports"));
      return {
        name: String(prov?.name || "").toLowerCase(),
        metrics: {
          // a API não expõe "enviados" por provedor → derivado
          sent: a.delivered + a.bounced + a.blocked,
          ...a,
        } as MetricSet,
      };
    })
    .filter((r) => r.name)
    .sort((x, y) => (y.metrics.sent ?? 0) - (x.metrics.sent ?? 0));
}

// Rótulos dos motivos de drop, na ordem em que fazem sentido ler.
const DROP_FIELDS: [string, string][] = [
  ["frequencyDrop", "Frequency cap"],
  ["unsubscribeDrop", "Descadastrados"],
  ["spamDrop", "Marcaram spam"],
  ["bounceDrop", "Bounce anterior"],
  ["invalidDrop", "E-mail inválido"],
  ["systemDrops", "Sistema"],
  ["sendingDrops", "Total não enviado"],
];

export interface EmailCampaignStats {
  metrics: MetricSet;
  isp: IspRow[];
  links: LinkClick[];
  drops: DropRow[];
}

export async function emailCampaignStats(
  brand: BrandId,
  campaignId: string,
  start: Date,
  end: Date,
): Promise<EmailCampaignStats> {
  const url =
    `${BASE}/email/v2/campaign/statistics?campaignId=${encodeURIComponent(campaignId)}` +
    `&startTime=${epochSec(start)}&endTime=${epochSec(end)}`;
  const json = await insiderFetch(url, { headers: { "X-INS-AUTH-KEY": insiderEnv.emailKey(brand) } });
  const s = (pick(json, "data.summary", "summary") as any) || {};
  const rawIsp = ((pick(json, "data.isp", "isp") as any[]) || []) as any[];
  const rawLinks = ((pick(s, "linkClickActivity") as any[]) || []) as any[];

  return {
    metrics: summaryToMetrics(s),
    isp: ispRows(rawIsp),
    links: rawLinks
      .map((l) => ({
        link: String(l?.link || ""),
        totalClicks: num(l?.totalClick),
        uniqueClicks: num(l?.uniqueClick),
      }))
      .filter((l) => l.link)
      .sort((a, b) => b.totalClicks - a.totalClicks),
    drops: DROP_FIELDS.map(([field, label]) => ({ label, count: num(s[field]) })).filter((d) => d.count > 0),
  };
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
    return fetchAll(brand, start, end);
  },
};
