"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
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
import { getReadingStaminaCurve } from "@/lib/reading-analytics";

export function ReadingStaminaCurve() {
  const graded = useStudyStore((s) => s.graded);

  const data = useMemo(() => {
    return getReadingStaminaCurve(graded).map((entry) => ({
      bucket: entry.bucketLabel,
      pct: Math.round(entry.bucket.pct * 100),
      observations: entry.bucket.total,
      correct: entry.bucket.correct,
    }));
  }, [graded]);

  const hasData = data.some((d) => d.observations > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stamina curve (mock attempts only)</CardTitle>
        <p className="text-sm text-gray-500">
          Accuracy by question position in a mock. A drop in later buckets
          signals fatigue under exam conditions.
        </p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-gray-500">
            Complete a full reading mock to see your stamina curve. Themed
            sessions aren&apos;t counted here.
          </p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, _name, props) => [
                    `${value}% (${props.payload.correct}/${props.payload.observations})`,
                    "Accuracy",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 5 }}
                  name="Accuracy"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
