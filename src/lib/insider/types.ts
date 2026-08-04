// Modelo de dados normalizado, comum a todos os canais.

export type ChannelId = "email" | "sms" | "whatsapp" | "webpush" | "apppush";

export type PeriodId = "year" | "30d" | "15d" | "7d" | "2d" | "today" | "custom";

export type MetricKey =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "converted"
  | "revenue"
  | "bottles"
  | "cost"
  | "unsubscribed"
  | "bounced";

export type MetricSet = Partial<Record<MetricKey, number>>;

export type MetricFormat = "int" | "brl" | "pct";

export interface MetricDef {
  key: MetricKey;
  label: string;
  format: MetricFormat;
  kind: "count" | "money";
}

export interface DailyPoint {
  /** Rótulo/label do bucket. Para bucket=day é YYYY-MM-DD. */
  date: string;
  /** Data inicial do bucket (ISO) — usada no eixo/heatmap. */
  start: string;
  metrics: MetricSet;
}

export interface CampaignRow {
  name: string;
  status?: string;
  /** Hora de envio (0–23, fuso America/Sao_Paulo). Ausente = sem horário fixo. */
  hour?: number;
  metrics: MetricSet;
}

export interface HourPoint {
  hour: number; // 0–23
  metrics: MetricSet;
  /** nº de campanhas enviadas nessa hora (no período). */
  count: number;
}

export interface AnalyticsResult {
  channel: ChannelId;
  channelLabel: string;
  range: { start: string; end: string };
  bucket: "day" | "week";
  primary: MetricKey;
  metrics: MetricDef[];
  kpis: MetricSet;
  series: DailyPoint[];
  campaigns: CampaignRow[];
  /** Agregação por hora de envio (0–23). Vazio p/ canais sem horário. */
  hourly: HourPoint[];
  notes: string[];
  ok: boolean;
  /** Presente quando ok=false (erro de credencial/limite/etc). */
  error?: string;
}
