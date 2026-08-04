"use client";
import { useMemo, useState } from "react";
import type { AnalyticsResult, MetricKey } from "@/lib/insider/types";
import { formatValue } from "@/lib/format";

type SortKey = MetricKey | "name";

export default function CampaignTable({ result }: { result: AnalyticsResult }) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(result.primary);
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const cols = result.metrics;

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const filtered = result.campaigns.filter((c) => !f || c.name.toLowerCase().includes(f));
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "name") {
        return dir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      const av = a.metrics[sortKey] ?? 0;
      const bv = b.metrics[sortKey] ?? 0;
      return dir === "asc" ? av - bv : bv - av;
    });
    return sorted;
  }, [result.campaigns, filter, sortKey, dir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setDir(k === "name" ? "asc" : "desc");
    }
  }

  const arrow = (k: SortKey) => (k === sortKey ? (dir === "asc" ? " ▲" : " ▼") : "");

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
                <th key={c.key} className="num sortable" onClick={() => toggleSort(c.key)}>
                  {c.label}
                  {arrow(c.key)}
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
                  <td key={c.key} className={"num" + (c.kind === "money" ? " money" : "")}>
                    {r.metrics[c.key] != null ? formatValue(r.metrics[c.key], c.format) : "—"}
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
