"use client";
import { useMemo, useState } from "react";
import type { AnalyticsResult, MetricFormat, MetricKey, MetricSet } from "@/lib/insider/types";
import { formatValue } from "@/lib/format";

// Coluna: contagem (uma métrica) ou taxa derivada (num/den).
type Col =
  | { id: string; label: string; type: "count"; key: MetricKey; format: MetricFormat; money?: boolean }
  | { id: string; label: string; type: "rate"; num: MetricKey; den: MetricKey };

// Colunas do Email — contagens + % intercaladas (mesma ordem dos cards).
const EMAIL_COLS: Col[] = [
  { id: "sent", label: "Enviados", type: "count", key: "sent", format: "int" },
  { id: "delivered", label: "Entregues", type: "count", key: "delivered", format: "int" },
  { id: "pct_delivered", label: "% entregues", type: "rate", num: "delivered", den: "sent" },
  { id: "opened", label: "Aberturas", type: "count", key: "opened", format: "int" },
  { id: "pct_opened", label: "% aberturas", type: "rate", num: "opened", den: "delivered" },
  { id: "clicked", label: "Cliques", type: "count", key: "clicked", format: "int" },
  { id: "ctor", label: "% CTOR", type: "rate", num: "clicked", den: "opened" },
  { id: "unsubscribed", label: "Descadastro", type: "count", key: "unsubscribed", format: "int" },
  { id: "pct_unsub", label: "% descadastro", type: "rate", num: "unsubscribed", den: "sent" },
  { id: "bounced", label: "Bounces", type: "count", key: "bounced", format: "int" },
  { id: "pct_bounce", label: "% bounces", type: "rate", num: "bounced", den: "sent" },
  { id: "blocked", label: "Bloqueios", type: "count", key: "blocked", format: "int" },
  { id: "pct_block", label: "% bloqueios", type: "rate", num: "blocked", den: "sent" },
  { id: "conv_rate", label: "Taxa de conversão", type: "rate", num: "converted", den: "clicked" },
  { id: "converted", label: "Conversões", type: "count", key: "converted", format: "int" },
  { id: "revenue", label: "Receita", type: "count", key: "revenue", format: "brl", money: true },
  { id: "bottles", label: "Garrafas", type: "count", key: "bottles", format: "int" },
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
function colValue(col: Col, m: MetricSet): number | undefined {
  return col.type === "count" ? m[col.key] : rate(m[col.num], m[col.den]);
}
function colDisplay(col: Col, m: MetricSet): string {
  const v = colValue(col, m);
  if (v == null) return "—";
  return col.type === "count" ? formatValue(v, col.format) : formatPct(v);
}

export default function CampaignTable({ result }: { result: AnalyticsResult }) {
  const [filter, setFilter] = useState("");
  const [sortId, setSortId] = useState<string>(result.primary);
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const cols: Col[] =
    result.channel === "email"
      ? EMAIL_COLS
      : result.metrics.map((m) => ({
          id: m.key,
          label: m.label,
          type: "count",
          key: m.key,
          format: m.format,
          money: m.kind === "money",
        }));

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const filtered = result.campaigns.filter((c) => !f || c.name.toLowerCase().includes(f));
    const col = cols.find((c) => c.id === sortId);
    const sorted = [...filtered].sort((a, b) => {
      if (sortId === "name" || !col) {
        return dir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      const av = colValue(col, a.metrics) ?? 0;
      const bv = colValue(col, b.metrics) ?? 0;
      return dir === "asc" ? av - bv : bv - av;
    });
    return sorted;
  }, [result.campaigns, cols, filter, sortId, dir]);

  function toggleSort(id: string) {
    if (id === sortId) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortId(id);
      setDir(id === "name" ? "asc" : "desc");
    }
  }
  const arrow = (id: string) => (id === sortId ? (dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div>
      <div className="tbl-toolbar">
        <span className="tbl-count">{rows.length} campanhas</span>
        <input
          className="tbl-filter"
          placeholder="Filtrar campanhas…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="tbl-scroll">
        <table className="camp-table">
          <thead>
            <tr>
              <th className="lft sortable" onClick={() => toggleSort("name")}>
                Campanha{arrow("name")}
              </th>
              {cols.map((c) => (
                <th key={c.id} className="num sortable" onClick={() => toggleSort(c.id)}>
                  {c.label}
                  {arrow(c.id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="lft name" title={r.name}>
                  {r.name}
                </td>
                {cols.map((c) => (
                  <td key={c.id} className={"num" + (c.type === "count" && c.money ? " money" : "")}>
                    {colDisplay(c, r.metrics)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="lft empty-cell" colSpan={cols.length + 1}>
                  Nenhuma campanha no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
