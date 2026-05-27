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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useStudyStore } from "@/hooks/useStudyStore";
import {
  CELPIP_READING_PARTS,
  CELPIP_READING_PART_LABELS,
  getReadingAccuracyByPart,
} from "@/lib/reading-analytics";

function colorForPct(pct: number): string {
  if (pct >= 0.8) return "#22c55e";
  if (pct >= 0.6) return "#3b82f6";
  if (pct >= 0.4) return "#f59e0b";
  return "#ef4444";
}

export function ReadingPartAccuracy() {
  const graded = useStudyStore((s) => s.graded);

  const data = useMemo(() => {
    const byPart = getReadingAccuracyByPart(graded);
    return CELPIP_READING_PARTS.map((part) => ({
      part,
      label: CELPIP_READING_PART_LABELS[part],
      shortLabel: part.replace("part_", "P"),
      pct: byPart[part].pct,
      pctRounded: Math.round(byPart[part].pct * 100),
      correct: byPart[part].correct,
      total: byPart[part].total,
    }));
  }, [graded]);

  const hasData = data.some((d) => d.total > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reading accuracy by CELPIP Part</CardTitle>
        <p className="text-sm text-gray-500">
          Percent correct on each Part — combines themed and mock attempts.
        </p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-gray-500">
            Per-Part accuracy appears here once reading questions have been
            graded with CELPIP Part tags.
          </p>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="shortLabel" tick={{ fontSize: 12 }} />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    label={{
                      value: "% correct",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    formatter={(value, _name, props) => [
                      `${value}% (${props.payload.correct}/${props.payload.total})`,
                      props.payload.label,
                    ]}
                    labelFormatter={() => ""}
                  />
                  <Bar dataKey="pctRounded" radius={[6, 6, 0, 0]}>
                    {data.map((d) => (
                      <Cell key={d.part} fill={colorForPct(d.pct)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
              {data.map((d) => (
                <li key={d.part} className="flex justify-between gap-2">
                  <span className="truncate">{d.label}</span>
                  <span className="font-medium">
                    {d.total > 0
                      ? `${d.pctRounded}% · ${d.correct}/${d.total}`
                      : "no data"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
