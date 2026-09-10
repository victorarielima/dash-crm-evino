"use client";
import type { ChannelId, MetricDef, MetricKey, MetricSet } from "@/lib/insider/types";
import { formatValue } from "@/lib/format";

function rate(num?: number, den?: number): number | undefined {
  if (num == null || !den) return undefined;
  return (num / den) * 100;
}

// % com precisão adaptativa: 2 casas p/ taxas pequenas (<1%), senão 1 casa.
function formatPct(v?: number): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const d = Math.abs(v) < 1 ? 2 : 1;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
}

interface Card {
  label: string;
  value: string;
  money: boolean;
}

// Ordem e cards do canal Email (contagens + % intercaladas).
// Cada item é uma contagem (key) ou uma taxa (num/den com base definida).
type EmailSpec =
  | { label: string; key: MetricKey }
  | { label: string; num: MetricKey; den: MetricKey };

const EMAIL_ORDER: EmailSpec[] = [
  { label: "Enviados", key: "sent" },
  { label: "Entregues", key: "delivered" },
  { label: "% de entregues", num: "delivered", den: "sent" },
  { label: "Aberturas", key: "opened" },
  { label: "% de aberturas", num: "opened", den: "delivered" },
  { label: "Cliques", key: "clicked" },
  { label: "% CTOR (cliques vs aberturas)", num: "clicked", den: "opened" },
  { label: "Descadastro", key: "unsubscribed" },
  { label: "% de descadastro (vs enviados)", num: "unsubscribed", den: "sent" },
  { label: "Bounces", key: "bounced" },
  { label: "% de bounces (vs enviados)", num: "bounced", den: "sent" },
  { label: "Bloqueios", key: "blocked" },
  { label: "% de bloqueios (vs enviados)", num: "blocked", den: "sent" },
  { label: "Qtd de SPAM", key: "spam" },
  { label: "% SPAM report (vs entregues)", num: "spam", den: "delivered" },
  { label: "Taxa de conversão (vs cliques)", num: "converted", den: "clicked" },
];

function emailCards(k: MetricSet): Card[] {
  return EMAIL_ORDER.map((spec) => {
    if ("key" in spec) {
      return { label: spec.label, value: formatValue(k[spec.key], "int"), money: false };
    }
    return { label: spec.label, value: formatPct(rate(k[spec.num], k[spec.den])), money: false };
  });
}

/** Fonte mínima dos cards — atendida tanto por AnalyticsResult quanto por CampaignDetail. */
interface KpiSource {
  channel: ChannelId;
  metrics: MetricDef[];
  kpis: MetricSet;
}

function genericCards(result: KpiSource, exclude: MetricKey[]): Card[] {
  const k = result.kpis;
  const cards: Card[] = result.metrics
    .filter((m) => k[m.key] != null && !exclude.includes(m.key))
    .map((m) => ({ label: m.label, value: formatValue(k[m.key], m.format), money: m.kind === "money" }));

  const derived: { label: string; value: number | undefined }[] = [
    { label: "Taxa de entrega", value: rate(k.delivered, k.sent) },
    { label: "Taxa de abertura", value: rate(k.opened, k.delivered) },
    { label: "CTR", value: rate(k.clicked, k.delivered) },
    { label: "Taxa de conversão", value: rate(k.converted, k.clicked ?? k.delivered) },
  ];
  for (const d of derived) {
    if (d.value != null && Number.isFinite(d.value)) {
      cards.push({ label: d.label, value: formatValue(d.value, "pct"), money: false });
    }
  }
  return cards;
}

export default function KpiCards({ result, exclude = [] }: { result: KpiSource; exclude?: MetricKey[] }) {
  const cards = result.channel === "email" ? emailCards(result.kpis) : genericCards(result, exclude);
  if (cards.length === 0) return null;

  return (
    <div className="kpis">
      {cards.map((c, i) => (
        <div className="kpi" key={i}>
          <div className="lab">{c.label}</div>
          <div className={"val" + (c.money ? " money" : "")}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
