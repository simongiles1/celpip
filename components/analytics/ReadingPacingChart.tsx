"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
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
  getReadingPacingByPart,
} from "@/lib/reading-analytics";

export function ReadingPacingChart() {
  const graded = useStudyStore((s) => s.graded);

  const data = useMemo(() => {
    const byPart = getReadingPacingByPart(graded);
    return CELPIP_READING_PARTS.map((part) => ({
      part,
      label: CELPIP_READING_PART_LABELS[part],
      shortLabel: part.replace("part_", "P"),
      avgSeconds: Math.round(byPart[part].avgSeconds),
      targetSeconds: byPart[part].targetSeconds,
      observations: byPart[part].observations,
    }));
  }, [graded]);

  const hasData = data.some((d) => d.observations > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pacing — seconds per question by Part</CardTitle>
        <p className="text-sm text-gray-500">
          Bars = your average. Reference line = official CELPIP target. Bars
          above the line = too slow.
        </p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-gray-500">
            Pacing data appears once you complete reading questions with timing
            captured.
          </p>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="shortLabel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value, name, props) => {
                      if (name === "Your avg") {
                        return [
                          `${value}s (n=${props.payload.observations})`,
                          props.payload.label,
                        ];
                      }
                      return [`${value}s`, "CELPIP target"];
                    }}
                    labelFormatter={() => ""}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="avgSeconds"
                    name="Your avg"
                    radius={[6, 6, 0, 0]}
                  >
                    {data.map((d) => (
                      <Cell
                        key={d.part}
                        fill={
                          d.observations === 0
                            ? "#d1d5db"
                            : d.avgSeconds > d.targetSeconds
                              ? "#ef4444"
                              : "#22c55e"
                        }
                      />
                    ))}
                  </Bar>
                  <ReferenceLine
                    y={
                      data.reduce((sum, d) => sum + d.targetSeconds, 0) /
                      data.length
                    }
                    stroke="#9ca3af"
                    strokeDasharray="4 4"
                    label={{
                      value: "Avg target",
                      fill: "#6b7280",
                      fontSize: 11,
                      position: "right",
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
              {data.map((d) => (
                <li key={d.part} className="flex justify-between gap-2">
                  <span className="truncate">{d.label}</span>
                  <span className="font-medium">
                    {d.observations > 0
                      ? `${d.avgSeconds}s avg (target ${d.targetSeconds}s, n=${d.observations})`
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
