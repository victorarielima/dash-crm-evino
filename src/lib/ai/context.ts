// Monta o "contexto de dados" que alimenta a IA a partir do mesmo motor de
// analytics do dashboard (runQuery). Retorna objetos compactos (JSON) que
// serão enviados ao modelo como contexto do sistema.
import { runQuery } from "@/lib/insider";
import { CHANNELS } from "@/lib/catalog";
import { DEFAULT_BRAND } from "@/lib/brands";
import type { AnalyticsResult, BrandId, ChannelId, PeriodId } from "@/lib/insider/types";

function topCampaigns(r: AnalyticsResult, n = 12) {
  return [...r.campaigns]
    .sort((a, b) => (b.metrics.revenue ?? 0) - (a.metrics.revenue ?? 0))
    .slice(0, n)
    .map((c) => ({ nome: c.name, status: c.status, hora_envio: c.hour, ...c.metrics }));
}

function topHours(r: AnalyticsResult, n = 5) {
  return [...r.hourly]
    .filter((h) => (h.metrics.revenue ?? 0) > 0 || (h.metrics.converted ?? 0) > 0)
    .sort((a, b) => (b.metrics.revenue ?? 0) - (a.metrics.revenue ?? 0))
    .slice(0, n)
    .map((h) => ({ hora: h.hour, ...h.metrics }));
}

export interface ChatContextInput {
  brand?: BrandId;
  channel?: ChannelId;
  period?: PeriodId;
  campaignName?: string;
}

/** Contexto de UM canal (opcionalmente focado numa campanha). */
export async function buildChannelContext(
  brand: BrandId,
  channel: ChannelId,
  period: PeriodId,
  campaignName?: string,
) {
  const r = await runQuery(brand, channel, period);
  const ctx: Record<string, unknown> = {
    tipo: "canal",
    conta: r.brandLabel,
    canal: r.channelLabel,
    periodo: r.range,
    kpis: r.kpis,
    melhores_horarios_de_compra: topHours(r),
    top_campanhas: topCampaigns(r),
    observacoes: r.notes,
  };
  if (campaignName) {
    const c = r.campaigns.find((x) => x.name === campaignName);
    ctx.campanha_em_foco = c
      ? { nome: c.name, status: c.status, hora_envio: c.hour, ...c.metrics }
      : { nome: campaignName, aviso: "não encontrada no período selecionado" };
  }
  return ctx;
}

/** Visão geral: KPIs de todos os canais no período (análise sem campanha específica). */
export async function buildOverviewContext(brand: BrandId, period: PeriodId) {
  const ids = CHANNELS.map((c) => c.id);
  const canais = await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await runQuery(brand, id, period);
        return { canal: r.channelLabel, periodo: r.range, kpis: r.kpis, top_campanhas: topCampaigns(r, 5) };
      } catch (e: any) {
        return { canal: id, erro: e?.message || String(e) };
      }
    }),
  );
  return { tipo: "geral", conta: brand, periodo: period, canais };
}

export async function buildContext(input: ChatContextInput) {
  const period = input.period ?? "30d";
  const brand = input.brand ?? DEFAULT_BRAND;
  if (input.channel) return buildChannelContext(brand, input.channel, period, input.campaignName);
  return buildOverviewContext(brand, period);
}
