import { InsiderError } from "./env";
import { dayCount, isoDay, resolveRange, splitBuckets, type DateRange } from "./periods";
import { pool } from "./pool";
import type { AnalyticsResult, CampaignRow, ChannelId, HourPoint, MetricKey, MetricSet, PeriodId } from "./types";
import {
  RS_CHANNEL,
  revenueByCampaign,
  revenueByDay,
  revenueByHour,
  revenueSummary,
} from "../redshiftRevenue";
import { emailAdapter } from "./adapters/email";
import { smsAdapter } from "./adapters/sms";
import { whatsappAdapter } from "./adapters/whatsapp";
import { webpushAdapter } from "./adapters/webpush";
import { apppushAdapter } from "./adapters/apppush";
import type { ChannelAdapter } from "./adapters/base";

const ADAPTERS: Record<ChannelId, ChannelAdapter> = {
  email: emailAdapter,
  sms: smsAdapter,
  whatsapp: whatsappAdapter,
  webpush: webpushAdapter,
  apppush: apppushAdapter,
};

const CONCURRENCY: Partial<Record<ChannelId, number>> = {
  webpush: 2, // 30 req/min
  apppush: 1,
};

export async function runQuery(
  channel: ChannelId,
  period: PeriodId,
  customStart?: string,
  customEnd?: string,
): Promise<AnalyticsResult> {
  const adapter = ADAPTERS[channel];
  if (!adapter) throw new InsiderError(`Canal desconhecido: ${channel}`);
  const range = resolveRange(period, customStart, customEnd);

  const shell = (): Omit<AnalyticsResult, "kpis" | "series" | "ok" | "campaigns" | "hourly"> => ({
    channel,
    channelLabel: adapter.label,
    range: { start: isoDay(range.start), end: isoDay(range.end) },
    bucket: dayCount(range) <= 45 ? "day" : "week",
    primary: adapter.primary,
    metrics: adapter.metrics,
    notes: adapter.note ? [adapter.note] : [],
  });

  // Canal sem histórico (App Push): só o dia atual.
  if (!adapter.supportsHistory) {
    const notes = adapter.note ? [adapter.note] : [];
    if (period !== "today") notes.push("Período ignorado: este canal só expõe o dia atual.");
    try {
      const m = await adapter.fetchRange(range.start, range.end);
      const today = isoDay(new Date());
      return {
        ...shell(),
        bucket: "day",
        notes,
        kpis: m,
        series: [{ date: today, start: today, metrics: m }],
        campaigns: [],
        hourly: [],
        ok: true,
      };
    } catch (e: any) {
      return { ...shell(), notes, kpis: {}, series: [], campaigns: [], hourly: [], ok: false, error: msg(e) };
    }
  }

  // Canais com histórico: KPIs = 1 chamada de range; série = fan-out por bucket.
  let kpis;
  try {
    kpis = await adapter.fetchRange(range.start, range.end);
  } catch (e: any) {
    return { ...shell(), kpis: {}, series: [], campaigns: [], hourly: [], ok: false, error: msg(e) };
  }

  const { granularity, buckets } = splitBuckets(range);
  const conc = CONCURRENCY[channel] ?? 6;

  // série (fan-out por bucket) e campanhas rodam em paralelo
  const seriesPromise = pool(buckets, conc, async (b) => {
    try {
      return await adapter.fetchRange(b.start, b.end);
    } catch {
      return {}; // lacuna pontual não derruba o período
    }
  });
  const campaignsPromise: Promise<CampaignRow[]> = adapter.fetchCampaigns
    ? adapter.fetchCampaigns(range.start, range.end).catch(() => [])
    : Promise.resolve([]);

  const [seriesMetrics, campaigns] = await Promise.all([seriesPromise, campaignsPromise]);

  const series = buckets.map((b, i) => ({
    date: b.key,
    start: b.start.toISOString(),
    metrics: seriesMetrics[i] || {},
  }));

  let hourly = aggregateHourly(campaigns);

  const notes = adapter.note ? [adapter.note] : [];
  if (granularity === "week") notes.push("Período longo: série agregada por semana.");

  // ── Receita/conversões/garrafas + horário REAL de compra vêm do Redshift ──
  const rsCh = RS_CHANNEL[channel];
  const hasRevenue = adapter.metrics.some((m) => m.key === "revenue");
  if (rsCh && hasRevenue) {
    try {
      const [sum, byDay, byHour, byCamp] = await Promise.all([
        revenueSummary(rsCh, range.start, range.end),
        revenueByDay(rsCh, range.start, range.end),
        revenueByHour(rsCh, range.start, range.end),
        revenueByCampaign(rsCh, range.start, range.end),
      ]);
      // KPIs
      kpis.revenue = sum.revenue;
      kpis.converted = sum.orders;
      kpis.bottles = sum.bottles;
      // série diária
      for (const p of series) {
        const d = byDay.get(p.date);
        p.metrics.revenue = d?.revenue ?? 0;
        p.metrics.converted = d?.orders ?? 0;
        p.metrics.bottles = d?.bottles ?? 0;
      }
      // por campanha (join por utm_campaign == nome da campanha)
      for (const c of campaigns) {
        const r = byCamp.get(c.name);
        c.metrics.revenue = r?.revenue ?? 0;
        c.metrics.converted = r?.orders ?? 0;
        c.metrics.bottles = r?.bottles ?? 0;
      }
      // heatmap = horário REAL da compra (substitui o horário de envio)
      hourly = byHour.map((h, hour) => ({
        hour,
        count: 0,
        metrics: { revenue: h.revenue, converted: h.orders, bottles: h.bottles },
      }));
    } catch (e) {
      notes.push("Redshift indisponível — receita/conversões mantidas da Insider. " + msg(e));
    }
  }

  return { ...shell(), bucket: granularity, kpis, series, campaigns, hourly, notes, ok: true };
}

const METRIC_KEYS: MetricKey[] = [
  "sent", "delivered", "opened", "clicked", "converted", "revenue", "bottles", "cost", "unsubscribed", "bounced",
];

/** Agrega métricas das campanhas pela hora de envio (0–23). Vazio se nenhuma tem hora. */
function aggregateHourly(campaigns: CampaignRow[]): HourPoint[] {
  const withHour = campaigns.filter((c) => typeof c.hour === "number");
  if (!withHour.length) return [];
  const buckets: HourPoint[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
    metrics: {} as MetricSet,
  }));
  for (const c of withHour) {
    const b = buckets[c.hour as number];
    b.count += 1;
    for (const k of METRIC_KEYS) {
      const v = c.metrics[k];
      if (typeof v === "number") b.metrics[k] = (b.metrics[k] ?? 0) + v;
    }
  }
  return buckets;
}

function msg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export { resolveRange };
export type { DateRange };
