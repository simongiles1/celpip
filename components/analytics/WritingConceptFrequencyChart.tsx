"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { getConceptById } from "@/lib/skill-profile";
import {
  countWritingExercises,
  getWritingConceptStatsEntries,
} from "@/lib/writing-analytics";

export function WritingConceptFrequencyChart() {
  const graded = useStudyStore((s) => s.graded);
  const skillProfile = useStudyStore((s) => s.skillProfile);

  const { data, writingExerciseCount } = useMemo(() => {
    const entries = getWritingConceptStatsEntries(skillProfile, graded);
    return {
      writingExerciseCount: countWritingExercises(graded),
      data: entries.map((entry) => {
        const label =
          getConceptById(skillProfile, entry.conceptId)?.label ??
          entry.conceptId.replace(/_/g, " ");
        return {
          conceptId: entry.conceptId,
          label,
          exerciseCount: entry.exerciseCount,
          instanceCount: entry.instanceCount,
        };
      }),
    };
  }, [graded, skillProfile]);

  const chartHeight = Math.max(260, data.length * 52);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Writing concepts to prioritize</CardTitle>
        <p className="text-sm text-gray-500">
          Two views of the same feedback: how many exercises flagged each concept
          (breadth) vs how many individual mistakes were tagged (volume). Based
          on {writingExerciseCount} graded writing exercise
          {writingExerciseCount !== 1 ? "s" : ""}.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">
            Complete and grade writing sessions to see which concepts show up
            most often in your feedback.
          </p>
        ) : (
          <div className="w-full" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  width={160}
                />
                <Tooltip
                  formatter={(value, name, props) => {
                    const label = props.payload.label as string;
                    if (name === "Exercises") {
                      return [
                        `${value} of ${writingExerciseCount} exercise${writingExerciseCount !== 1 ? "s" : ""}`,
                        label,
                      ];
                    }
                    return [`${value} tagged mistake${value === 1 ? "" : "s"}`, label];
                  }}
                  labelFormatter={() => ""}
                />
                <Legend />
                <Bar
                  dataKey="exerciseCount"
                  name="Exercises"
                  fill="#8b5cf6"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="instanceCount"
                  name="Instances"
                  fill="#ef4444"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {data.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            <span className="font-medium text-purple-800">Exercises</span> = concept
            flagged in that many separate writing sessions (counted once per
            session).{" "}
            <span className="font-medium text-red-700">Instances</span> = total
            weakness tags across all sessions (e.g. 3 in one exercise + 2 in
            another = 5). Practice in{" "}
            <Link href="/concepts" className="text-blue-600 hover:underline">
              Concept Lab
            </Link>
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}
