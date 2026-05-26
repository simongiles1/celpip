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
import { getCurriculumUnit } from "@/data/curriculum";
import { useStudyStore } from "@/hooks/useStudyStore";
import { formatDateISO } from "@/lib/utils";
import { parseISO } from "date-fns";

export function ScoreTimeline() {
  const graded = useStudyStore((s) => s.graded);
  const skillProfile = useStudyStore((s) => s.skillProfile);

  const chartData = graded
    .slice()
    .sort(
      (a, b) =>
        new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime(),
    )
    .map((session) => {
      const unit = getCurriculumUnit(session.curriculumUnitId, skillProfile);
      const type = session.focusSubTest;
      return {
        date: formatDateISO(parseISO(session.gradedAt)),
        band: session.estimatedBand,
        writingBand: type === "Writing" ? session.estimatedBand : null,
        readingBand: type === "Reading" ? session.estimatedBand : null,
        type,
        label: unit?.practiceType ?? session.focusSubTest,
      };
    });

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Score Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Complete and grade study sessions to see your CLB band progress over time.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score Timeline</CardTitle>
        <p className="text-sm text-gray-500">
          Overall, Reading, and Writing CLB bands over time
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
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
                stroke="#6b7280"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Overall"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="writingBand"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Writing"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="readingBand"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Reading"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
