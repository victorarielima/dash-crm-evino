"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsResult, MetricKey } from "@/lib/insider/types";
import { compact, compactBRL, formatDayLabel, formatValue } from "@/lib/format";

export default function TrendChart({
  result,
  metric,
}: {
  result: AnalyticsResult;
  metric: MetricKey;
}) {
  const def = result.metrics.find((m) => m.key === metric);
  const money = def?.format === "brl";
  const data = result.series.map((p) => ({
    label: formatDayLabel(p.date),
    value: p.metrics[metric] ?? 0,
  }));

  const axisFmt = (v: number) => (money ? compactBRL(v) : compact(v));

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke="#eceef2" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#dfe2e7" }} minTickGap={16} />
          <YAxis tickFormatter={axisFmt} tickLine={false} axisLine={false} width={54} />
          <Tooltip
            cursor={{ fill: "rgba(225,17,40,0.06)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;
              const v = payload[0].value as number;
              return (
                <div className="tt">
                  <div>{label}</div>
                  <b>{formatValue(v, def?.format ?? "int")}</b>
                </div>
              );
            }}
          />
          <Bar dataKey="value" fill="#e11128" radius={[2, 2, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
