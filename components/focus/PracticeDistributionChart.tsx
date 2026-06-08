"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PracticeDistributionChartPoint } from "@/lib/focus-priority";

export interface PracticeDistributionChartProps {
  data: PracticeDistributionChartPoint[];
  labels: Record<string, string>;
  meanIndex: number;
  sigma: number;
}

function truncateLabel(label: string, max = 18): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function PracticeDistributionChart({
  data,
  labels,
  meanIndex,
  sigma,
}: PracticeDistributionChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Complete calendar writing or a focus assessment to build your practice
        window.
      </p>
    );
  }

  const chartRows = data.map((point) => ({
    ...point,
    label: truncateLabel(
      labels[point.conceptId] ?? point.conceptId.replace(/_/g, " "),
    ),
  }));

  return (
    <div className="space-y-3">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartRows}
            margin={{ top: 12, right: 12, left: 0, bottom: 48 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval={0}
              angle={-22}
              textAnchor="end"
              height={56}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "Assigned share") {
                  return [`${value.toFixed(1)}%`, name];
                }
                return [`${value.toFixed(1)}%`, "Gaussian curve"];
              }}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as
                  | (typeof chartRows)[number]
                  | undefined;
                if (!row) return "";
                const rank = row.index + 1;
                const status = row.inWindow
                  ? "Active window"
                  : "Queued (share gated to 0)";
                return `#${rank} · ${status}`;
              }}
            />
            <Legend />
            <Bar
              dataKey="practiceShare"
              name="Assigned share"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            >
              {chartRows.map((entry) => (
                <Cell
                  key={entry.conceptId}
                  fill={entry.inWindow ? "#2563eb" : "#e5e7eb"}
                  stroke={entry.isFuture ? "#d1d5db" : undefined}
                  strokeDasharray={entry.isFuture ? "4 2" : undefined}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="curveShare"
              name="Gaussian curve"
              stroke="#ea580c"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#ea580c", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <p className="font-medium text-gray-800">Formula</p>
        <p className="mt-1 font-mono text-[11px] leading-relaxed">
          w(i) = exp(−½ · ((i − μ) / σ)²) &nbsp;·&nbsp; share(i) = w(i) / Σⱼ w(j)
          × 100
        </p>
        <p className="mt-1.5">
          μ = {meanIndex.toFixed(2)} (mean index, shifts right as lead concept
          improves) · σ = {sigma} · i = priority rank index (0 = highest
          priority). Bars show assigned share (0 for queued concepts). Orange
          curve is the normalized Gaussian over all visible slots — queued
          concepts sit on the tail until the window expands.
        </p>
      </div>
    </div>
  );
}
