"use client";
import type { IspRow, MetricFormat, MetricKey, MetricSet } from "@/lib/insider/types";
import { formatValue } from "@/lib/format";

type Col =
  | { label: string; type: "count"; key: MetricKey; format: MetricFormat }
  | { label: string; type: "rate"; num: MetricKey; den: MetricKey };

const ISP_COLS: Col[] = [
  { label: "Enviados", type: "count", key: "sent", format: "int" },
  { label: "Entregues", type: "count", key: "delivered", format: "int" },
  { label: "% entregues", type: "rate", num: "delivered", den: "sent" },
  { label: "Aberturas", type: "count", key: "opened", format: "int" },
  { label: "% aberturas", type: "rate", num: "opened", den: "delivered" },
  { label: "Cliques", type: "count", key: "clicked", format: "int" },
  { label: "% CTOR", type: "rate", num: "clicked", den: "opened" },
  { label: "Descadastro", type: "count", key: "unsubscribed", format: "int" },
  { label: "% descadastro", type: "rate", num: "unsubscribed", den: "sent" },
  { label: "Bounces", type: "count", key: "bounced", format: "int" },
  { label: "% bounces", type: "rate", num: "bounced", den: "sent" },
  { label: "Bloqueios", type: "count", key: "blocked", format: "int" },
  { label: "% bloqueios", type: "rate", num: "blocked", den: "sent" },
  { label: "Taxa de conversão", type: "rate", num: "converted", den: "clicked" },
];

function rate(num?: number, den?: number): number | undefined {
  if (num == null || !den) return undefined;
  return (num / den) * 100;
}
function formatPct(v?: number): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const d = Math.abs(v) < 1 ? 2 : 1;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
}
function display(col: Col, m: MetricSet): string {
  if (col.type === "count") return m[col.key] != null ? formatValue(m[col.key], col.format) : "—";
  return formatPct(rate(m[col.num], m[col.den]));
}
function providerLabel(name: string): string {
  if (name === "others") return "OUTROS";
  return name.toUpperCase();
}

// soma as métricas de contagem de todos os provedores (linha TOTAL)
function totals(rows: IspRow[]): MetricSet {
  const t: MetricSet = {};
  const keys: MetricKey[] = ["sent", "delivered", "opened", "clicked", "unsubscribed", "bounced", "blocked", "converted"];
  for (const k of keys) t[k] = rows.reduce((a, r) => a + (r.metrics[k] ?? 0), 0);
  return t;
}

export default function IspTable({ rows }: { rows: IspRow[] }) {
  if (!rows.length) return null;
  const total = totals(rows);

  return (
    <div className="tbl-scroll">
      <table className="camp-table">
        <thead>
          <tr>
            <th className="lft">Provedor</th>
            {ISP_COLS.map((c) => (
              <th key={c.label} className="num">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="lft name">{providerLabel(r.name)}</td>
              {ISP_COLS.map((c) => (
                <td key={c.label} className="num">
                  {display(c, r.metrics)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="isp-total">
            <td className="lft name">TOTAL</td>
            {ISP_COLS.map((c) => (
              <td key={c.label} className="num">
                {display(c, total)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
