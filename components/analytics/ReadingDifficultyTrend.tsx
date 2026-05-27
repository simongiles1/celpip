"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useStudyStore } from "@/hooks/useStudyStore";
import { getReadingDifficultyDistribution } from "@/lib/reading-analytics";

function colorForPct(pct: number): string {
  if (pct >= 0.8) return "#22c55e";
  if (pct >= 0.6) return "#3b82f6";
  if (pct >= 0.4) return "#f59e0b";
  return "#ef4444";
}

export function ReadingDifficultyTrend() {
  const graded = useStudyStore((s) => s.graded);

  const data = useMemo(
    () =>
      getReadingDifficultyDistribution(graded).map((entry) => ({
        clbBand: entry.clbBand,
        label: `CLB ${entry.clbBand}`,
        attempts: entry.attempts,
        pct: entry.accuracy.pct,
        pctRounded: Math.round(entry.accuracy.pct * 100),
      })),
    [graded],
  );

  const totalQuestions = data.reduce((sum, d) => sum + d.attempts, 0);
  const weighted =
    totalQuestions > 0
      ? data.reduce((sum, d) => sum + d.clbBand * d.attempts, 0) /
        totalQuestions
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Difficulty distribution & accuracy</CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span>Which CLB bands you have been practicing at.</span>
          {totalQuestions > 0 && (
            <Badge variant="outline">
              Weighted avg: CLB {weighted.toFixed(1)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">
            Difficulty distribution appears once passages carry a CLB target
            band.
          </p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Questions",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11 },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "% correct",
                    angle: 90,
                    position: "insideRight",
                    style: { fontSize: 11 },
                  }}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === "Questions"
                      ? [`${value}`, "Questions practiced"]
                      : [`${value}%`, "Accuracy"]
                  }
                />
                <Bar
                  yAxisId="left"
                  dataKey="attempts"
                  name="Questions"
                  radius={[6, 6, 0, 0]}
                  fill="#cbd5e1"
                />
                <Bar
                  yAxisId="right"
                  dataKey="pctRounded"
                  name="Accuracy"
                  radius={[6, 6, 0, 0]}
                >
                  {data.map((d) => (
                    <Cell key={d.clbBand} fill={colorForPct(d.pct)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
