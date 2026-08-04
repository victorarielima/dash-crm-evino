import { insiderEnv, InsiderError } from "../env";
import { isoDay } from "../periods";
import { insiderFetch, num, pick } from "../http";
import type { MetricSet } from "../types";
import { M, type ChannelAdapter } from "./base";

const BASE = "https://web-push.api.useinsider.com";

// Auth: Authorization: Bearer <chave geral> + partner_id como STRING.
export const webpushAdapter: ChannelAdapter = {
  id: "webpush",
  label: "Web Push",
  metrics: [M.sent, M.delivered, M.clicked, M.converted, M.revenue, M.bottles],
  primary: "revenue",
  supportsHistory: true,
  note: "Rate limit de 30 req/min: períodos longos são agregados por semana.",
  async fetchRange(start, end): Promise<MetricSet> {
    const partnerId = insiderEnv.webpushPartnerId();
    if (!partnerId) throw new InsiderError("INSIDER_WEBPUSH_PARTNER_ID não configurado.");
    const body = JSON.stringify({
      partner_id: partnerId, // string!
      start_date: isoDay(start),
      end_date: isoDay(end),
    });
    const json = await insiderFetch(`${BASE}/v1/statistics/top-metrics`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${insiderEnv.webpushKey()}`,
        "Content-Type": "application/json",
      },
      body,
    });
    // Estrutura real: { overview: { targeted:{sent}, deliveryRate:{delivered},
    //                   ctr:{clicks}, conversionRate:{conversions}, revenue:"23,813 BRL" } }
    const o = (pick(json, "overview") as any) || json;
    return {
      sent: num(pick(o, "targeted.sent")),
      delivered: num(pick(o, "deliveryRate.delivered")),
      clicked: num(pick(o, "ctr.clicks")),
      converted: num(pick(o, "conversionRate.conversions")),
      revenue: num(pick(o, "revenue")),
    };
  },
};
