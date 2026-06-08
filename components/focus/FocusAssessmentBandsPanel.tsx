"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudyStore } from "@/hooks/useStudyStore";
import { formatDateISO } from "@/lib/utils";
import { parseISO } from "date-fns";
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

const FOCUS_UNIT_ID = "focus-writing-assessment";

export function FocusAssessmentBandsPanel() {
  const graded = useStudyStore((s) => s.graded);

  const focusData = graded
    .filter((session) => session.curriculumUnitId === FOCUS_UNIT_ID)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime(),
    )
    .map((session) => ({
      date: formatDateISO(parseISO(session.gradedAt)),
      band: session.estimatedBand,
      source: "Focus assessment",
    }));

  const calendarWritingData = graded
    .filter(
      (session) =>
        session.focusSubTest === "Writing" &&
        session.curriculumUnitId !== FOCUS_UNIT_ID,
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime(),
    )
    .map((session) => ({
      date: formatDateISO(parseISO(session.gradedAt)),
      band: session.estimatedBand,
      source: "Calendar writing",
    }));

  const combined = [...calendarWritingData, ...focusData].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  if (combined.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assessment Bands</CardTitle>
          <p className="text-sm text-gray-600">
            CLB bands from calendar writing exercises and focused assessments.
            Complete calendar writing or a focus assessment to see your trend.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No writing assessments yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assessment Bands</CardTitle>
        <p className="text-sm text-gray-600">
          Writing CLB bands from your calendar exercises and focused
          assessments. Calendar data feeds your skill profile even before you
          start Focus Lab.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combined} margin={{ bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis domain={[1, 12]} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [`Band ${value ?? "—"}`, "CLB"]}
                labelFormatter={(label) => String(label)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="band"
                name="CLB Band"
                stroke="#2563eb"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props as {
                    cx: number;
                    cy: number;
                    payload: { source: string };
                  };
                  const fill =
                    payload.source === "Focus assessment" ? "#2563eb" : "#059669";
                  return (
                    <circle cx={cx} cy={cy} r={4} fill={fill} stroke={fill} />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 pb-1 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
            Calendar writing ({calendarWritingData.length})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />
            Focus assessment ({focusData.length})
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
