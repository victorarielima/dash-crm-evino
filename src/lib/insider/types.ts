// Modelo de dados normalizado, comum a todos os canais.

export type ChannelId = "email" | "sms" | "whatsapp" | "webpush" | "apppush";

/** Conta/marca consultada: cada uma tem sua conta Insider e suas tabelas no DW. */
export type BrandId = "evino" | "grandcru";

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
  | "bounced"
  | "blocked"
  | "spam";

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
  /** ID da campanha na Insider — usado para abrir a tela de detalhe. */
  id?: string;
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

/** Quebra por provedor de e-mail (ISP): gmail, yahoo, hotmail, uol… */
export interface IspRow {
  name: string;
  metrics: MetricSet;
}

/** Cliques por link do e-mail (linkClickActivity da Insider). */
export interface LinkClick {
  link: string;
  totalClicks: number;
  uniqueClicks: number;
}

/** Motivos de não-envio (drops) reportados pela Insider por campanha. */
export interface DropRow {
  label: string;
  count: number;
}

/** Detalhe de UMA campanha (tela /campanha). */
export interface CampaignDetail {
  brand: BrandId;
  brandLabel: string;
  channel: ChannelId;
  channelLabel: string;
  campaignId?: string;
  name: string;
  status?: string;
  /** Hora de envio (0–23) quando o canal informa. */
  hour?: number;
  range: { start: string; end: string };
  metrics: MetricDef[];
  kpis: MetricSet;
  /** Quebra por provedor — só Email (vem do endpoint de statistics da campanha). */
  isp: IspRow[];
  /** Cliques por link — só Email. */
  links: LinkClick[];
  /** Drops por motivo — só Email. */
  drops: DropRow[];
  notes: string[];
  ok: boolean;
  error?: string;
}

export interface AnalyticsResult {
  brand: BrandId;
  brandLabel: string;
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
