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
  getReadingAccuracyByQuestionType,
  READING_QUESTION_TYPE_LABELS,
} from "@/lib/reading-analytics";

function colorForPct(pct: number): string {
  if (pct >= 0.8) return "#22c55e";
  if (pct >= 0.6) return "#3b82f6";
  if (pct >= 0.4) return "#f59e0b";
  return "#ef4444";
}

export function ReadingQuestionTypeAccuracy() {
  const graded = useStudyStore((s) => s.graded);

  const data = useMemo(() => {
    return getReadingAccuracyByQuestionType(graded).map((entry) => ({
      type: entry.type,
      label: READING_QUESTION_TYPE_LABELS[entry.type],
      pct: entry.bucket.pct,
      pctRounded: Math.round(entry.bucket.pct * 100),
      correct: entry.bucket.correct,
      total: entry.bucket.total,
    }));
  }, [graded]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accuracy by question type</CardTitle>
        <p className="text-sm text-gray-500">
          Ranked worst to best so the weakest question type is the easiest to
          spot.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">
            Per-type accuracy appears once reading questions have been tagged
            (main idea, inference, paraphrase, etc.).
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ left: 110, right: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  width={110}
                />
                <Tooltip
                  formatter={(value, _name, props) => [
                    `${value}% (${props.payload.correct}/${props.payload.total})`,
                    props.payload.label,
                  ]}
                  labelFormatter={() => ""}
                />
                <Bar dataKey="pctRounded" radius={[0, 6, 6, 0]}>
                  {data.map((d) => (
                    <Cell key={d.type} fill={colorForPct(d.pct)} />
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
