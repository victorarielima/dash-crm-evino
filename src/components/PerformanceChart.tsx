"use client";
import {
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricFormat } from "@/lib/insider/types";
import { compact, compactBRL, formatValue } from "@/lib/format";

export interface Point {
  label: string;
  value: number;
}

export default function PerformanceChart({
  points,
  format,
  height = 320,
}: {
  points: Point[];
  format: MetricFormat;
  height?: number;
}) {
  const money = format === "brl";
  const axisFmt = (v: number) => (money ? compactBRL(v) : compact(v));

  const values = points.map((p) => p.value);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const data = points.map((p) => ({
    label: p.label,
    value: p.value,
    mult: avg > 0 ? p.value / avg : 0,
  }));

  const maxMult = data.reduce((a, d) => Math.max(a, d.mult), 0);
  const multMax = Math.max(2, Math.ceil(maxMult));
  const multTicks = Array.from({ length: multMax + 1 }, (_, i) => i);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 12, right: 10, bottom: 4, left: 4 }}>
          <YAxis
            yAxisId="mult"
            orientation="left"
            domain={[0, multMax]}
            ticks={multTicks}
            tickFormatter={(v: number) => `${v.toFixed(1).replace(".", ",")}x`}
            tickLine={false}
            axisLine={false}
            width={46}
          />
          <YAxis
            yAxisId="abs"
            orientation="right"
            tickFormatter={axisFmt}
            tickLine={false}
            axisLine={false}
            width={58}
          />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#dfe2e7" }} minTickGap={8} interval={0} />

          <Bar yAxisId="abs" dataKey="value" fill="#e8eaee" radius={[2, 2, 0, 0]} maxBarSize={30} />

          <ReferenceLine
            yAxisId="mult"
            y={1}
            stroke="#c3c8d0"
            strokeDasharray="5 5"
            label={{ value: "média", position: "right", fill: "#79828d", fontSize: 11 }}
          />

          <Line
            yAxisId="mult"
            type="monotone"
            dataKey="mult"
            stroke="#6d1418"
            strokeWidth={2.2}
            dot={{ r: 2.5, fill: "#6d1418", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />

          <Tooltip
            cursor={{ fill: "rgba(117,23,20,0.05)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;
              const row = payload[0].payload as { value: number; mult: number };
              return (
                <div className="tt">
                  <div>{label}</div>
                  <b>{formatValue(row.value, format)}</b>
                  <div style={{ marginTop: 2 }}>{row.mult.toFixed(2).replace(".", ",")}× a média</div>
                </div>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
