import type { MetricFormat } from "./insider/types";

const intFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatValue(value: number | undefined, format: MetricFormat): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (format === "brl") return brlFmt.format(value);
  if (format === "pct") return `${pctFmt.format(value)}%`;
  return intFmt.format(value);
}

/** Abrevia números grandes para eixos/heatmap (12.345 → 12k). */
export function compact(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${Math.round(value / 1000)}k`;
  return intFmt.format(value);
}

export function compactBRL(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `R$ ${Math.round(value / 1000)}k`;
  return brlFmt.format(value);
}

export function formatDayLabel(iso: string): string {
  // "2026-08-04" → "04/08"
  const [, m, d] = iso.split("-");
  if (!m || !d) return iso;
  return `${d}/${m}`;
}
