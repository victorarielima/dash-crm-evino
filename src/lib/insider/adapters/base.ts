import type { BrandId, CampaignRow, ChannelId, MetricDef, MetricKey, MetricSet } from "../types";

export interface ChannelAdapter {
  id: ChannelId;
  label: string;
  metrics: MetricDef[];
  primary: MetricKey;
  supportsHistory: boolean;
  /** Aviso fixo exibido na UI (ex.: limitação do App Push). */
  note?: string;
  /** Agrega métricas do canal para um intervalo [start, end], na conta da marca. */
  fetchRange(brand: BrandId, start: Date, end: Date): Promise<MetricSet>;
  /** Lista campanhas do período com indicadores por campanha (opcional). */
  fetchCampaigns?(brand: BrandId, start: Date, end: Date): Promise<CampaignRow[]>;
}

// Conjuntos de métricas por tipo de card, reaproveitados pelos adapters.
export const M = {
  sent: { key: "sent", label: "Enviados", format: "int", kind: "count" } as MetricDef,
  delivered: { key: "delivered", label: "Entregues", format: "int", kind: "count" } as MetricDef,
  opened: { key: "opened", label: "Aberturas", format: "int", kind: "count" } as MetricDef,
  clicked: { key: "clicked", label: "Cliques", format: "int", kind: "count" } as MetricDef,
  converted: { key: "converted", label: "Conversões", format: "int", kind: "count" } as MetricDef,
  revenue: { key: "revenue", label: "Receita", format: "brl", kind: "money" } as MetricDef,
  bottles: { key: "bottles", label: "Garrafas", format: "int", kind: "count" } as MetricDef,
  cost: { key: "cost", label: "Investimento", format: "brl", kind: "money" } as MetricDef,
  unsubscribed: { key: "unsubscribed", label: "Descadastros", format: "int", kind: "count" } as MetricDef,
  bounced: { key: "bounced", label: "Bounces", format: "int", kind: "count" } as MetricDef,
  blocked: { key: "blocked", label: "Bloqueios", format: "int", kind: "count" } as MetricDef,
  spam: { key: "spam", label: "Qtd de SPAM", format: "int", kind: "count" } as MetricDef,
};
