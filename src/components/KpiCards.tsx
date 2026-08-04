"use client";
import type { AnalyticsResult, MetricKey } from "@/lib/insider/types";
import { formatValue } from "@/lib/format";

function rate(num?: number, den?: number): number | undefined {
  if (!num || !den) return undefined;
  return (num / den) * 100;
}

export default function KpiCards({ result, exclude = [] }: { result: AnalyticsResult; exclude?: MetricKey[] }) {
  const k = result.kpis;
  const cards = result.metrics
    .filter((m) => k[m.key] != null && !exclude.includes(m.key))
    .map((m) => ({
      label: m.label,
      value: formatValue(k[m.key], m.format),
      money: m.kind === "money",
      sub: undefined as string | undefined,
    }));

  // Cards de taxa derivados (só quando as bases existem)
  const derived: { label: string; value: number | undefined }[] = [
    { label: "Taxa de entrega", value: rate(k.delivered, k.sent) },
    { label: "Taxa de abertura", value: rate(k.opened, k.delivered) },
    { label: "CTR", value: rate(k.clicked, k.delivered) },
    // conversão sobre cliques (funil): conversões vêm do Redshift (pedidos reais)
    { label: "Taxa de conversão", value: rate(k.converted, k.clicked ?? k.delivered) },
  ];
  for (const d of derived) {
    if (d.value != null && Number.isFinite(d.value)) {
      cards.push({ label: d.label, value: formatValue(d.value, "pct"), money: false, sub: undefined });
    }
  }

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
