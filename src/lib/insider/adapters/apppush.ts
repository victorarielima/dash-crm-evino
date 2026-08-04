import { insiderEnv, InsiderError } from "../env";
import { insiderFetch, num, pick } from "../http";
import type { MetricSet } from "../types";
import { M, type ChannelAdapter } from "./base";

const URL = "https://mobile.useinsider.com/api/v1/notification/get_statistics";

// get_statistics só cobre o dia atual (00:00 → agora) e exige a api_key do
// projeto MOBILE (INSIDER_MOBILE_API_KEY), diferente da chave de analytics.
export const apppushAdapter: ChannelAdapter = {
  id: "apppush",
  label: "App Push",
  // get_statistics só expõe entregas e sessões (sem receita/conversão).
  metrics: [M.delivered, M.opened],
  primary: "delivered",
  supportsHistory: false,
  note: "A API do App Push só retorna dados do dia atual (entregas e sessões; sem receita). Histórico exige export assíncrono (não incluído).",
  async fetchRange(): Promise<MetricSet> {
    const key = insiderEnv.mobileKey();
    if (!key) throw new InsiderError("INSIDER_MOBILE_API_KEY não configurado (chave do projeto Mobile).");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const partner = insiderEnv.partnerName();
    if (partner) headers["X-PARTNER-NAME"] = partner.toLowerCase();
    const json = await insiderFetch(URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ api_key: key }),
    });
    // Estrutura real: { campaigns: [{ delivery_count, session_count, ... }] }
    const list = (pick(json, "campaigns", "data", "result") as any) || json;
    const rows: any[] = Array.isArray(list) ? list : Array.isArray(list?.campaigns) ? list.campaigns : [];
    const agg: MetricSet = { delivered: 0, opened: 0 };
    for (const r of rows) {
      agg.delivered! += num(pick(r, "delivery_count", "delivered", "delivery"));
      agg.opened! += num(pick(r, "session_count", "sessions", "opened"));
    }
    return agg;
  },
};
