"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudyStore } from "@/hooks/useStudyStore";
import { formatDateISO } from "@/lib/utils";
import { parseISO } from "date-fns";

const FOCUS_UNIT_ID = "focus-writing-assessment";

export function FocusScoreTimeline() {
  const graded = useStudyStore((s) => s.graded);

  const chartData = graded
    .filter((session) => session.curriculumUnitId === FOCUS_UNIT_ID)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime(),
    )
    .map((session) => ({
      date: formatDateISO(parseISO(session.gradedAt)),
      band: session.estimatedBand,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Focus Assessment Bands</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Complete a focused assessment to track your writing band here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Focus Assessment Bands</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis domain={[1, 12]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="band"
              name="CLB Band"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
