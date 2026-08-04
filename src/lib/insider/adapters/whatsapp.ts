import { insiderEnv } from "../env";
import { ddmmyyyy } from "../periods";
import { pool } from "../pool";
import { insiderFetch, num, pick } from "../http";
import type { CampaignRow, MetricSet } from "../types";
import { M, type ChannelAdapter } from "./base";

const BASE = "https://architect-analytics.api.useinsider.com";
const MAX_JOURNEYS = 40;

function authHeaders() {
  return { Authorization: `Bearer ${insiderEnv.architectKey()}`, Accept: "application/json" };
}

function overallUrl(statDate: string, journeyId?: number): string {
  const qs = new URLSearchParams();
  qs.set("statDate", statDate);
  qs.append("channels[]", "whatsapp");
  if (journeyId != null) qs.append("ids[]", String(journeyId));
  return `${BASE}/v1/overall?${qs.toString()}`;
}

// WhatsApp sai do Architect: /v1/overall com channels[]=whatsapp.
export const whatsappAdapter: ChannelAdapter = {
  id: "whatsapp",
  label: "WhatsApp",
  metrics: [M.sent, M.delivered, M.clicked, M.converted, M.revenue, M.bottles],
  primary: "revenue",
  supportsHistory: true,
  note: "Dados via Architect (jornadas) filtrando o canal WhatsApp.",
  async fetchRange(start, end): Promise<MetricSet> {
    const statDate = `${ddmmyyyy(start)} - ${ddmmyyyy(end)}`;
    const json = await insiderFetch(overallUrl(statDate), { headers: authHeaders() });
    const um = (pick(json, "userMetrics") as any) || {};
    const pm = (pick(json, "performanceMetrics") as any) || {};
    const wa = (pick(json, "performanceOfChannels.whatsapp") as any) || {};
    return {
      sent: num(um.sent),
      delivered: num(um.delivered),
      clicked: num(pick(wa, "totalClicks") ?? pm.totalClicks),
      converted: num(pick(wa, "conversions") ?? pm.totalConversions),
      revenue: num(pick(wa, "revenue") ?? pm.revenue),
    };
  },
  async fetchCampaigns(start, end): Promise<CampaignRow[]> {
    const statDate = `${ddmmyyyy(start)} - ${ddmmyyyy(end)}`;
    // 1) jornadas com atividade de WhatsApp no período
    const overall = await insiderFetch(overallUrl(statDate), { headers: authHeaders() });
    const ids: number[] = ((pick(overall, "journeyIds") as any[]) || []).map(num).slice(0, MAX_JOURNEYS);
    if (!ids.length) return [];

    // 2) mapa id → nome
    const names: Record<number, { name: string; status?: string }> = {};
    try {
      const jl = await insiderFetch(`${BASE}/v1/journeys?limit=300`, { headers: authHeaders() });
      const list: any[] = (pick(jl, "journeys", "data") as any[]) || [];
      for (const j of list) {
        const id = num(pick(j, "journeyId", "id"));
        if (id) names[id] = { name: String(pick(j, "journeyName", "name") || id), status: j.status };
      }
    } catch {
      /* nomes são opcionais */
    }

    // 3) métricas por jornada (WhatsApp)
    const rows = await pool(ids, 5, async (id) => {
      try {
        const j = await insiderFetch(overallUrl(statDate, id), { headers: authHeaders() });
        const wa = (pick(j, "performanceOfChannels.whatsapp") as any) || {};
        const um = (pick(j, "userMetrics") as any) || {};
        return {
          name: names[id]?.name || `Jornada ${id}`,
          status: names[id]?.status,
          metrics: {
            sent: num(pick(wa, "sent") ?? um.sent),
            delivered: num(pick(wa, "delivered") ?? um.delivered),
            clicked: num(wa.totalClicks),
            converted: num(wa.conversions),
            revenue: num(wa.revenue),
          },
        } as CampaignRow;
      } catch {
        return { name: names[id]?.name || `Jornada ${id}`, metrics: {} } as CampaignRow;
      }
    });
    // maiores receitas primeiro
    return rows.sort((a, b) => (b.metrics.revenue ?? 0) - (a.metrics.revenue ?? 0));
  },
};
