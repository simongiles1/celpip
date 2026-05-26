"use client";

import { useMemo, useState } from "react";
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
import { getConceptById, getWeakConcepts } from "@/lib/skill-profile";
import { formatDateISO } from "@/lib/utils";
import { parseISO } from "date-fns";

export function ConceptTrendChart() {
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const weak = getWeakConcepts(skillProfile, 5);
  const [selectedId, setSelectedId] = useState<string>(
    () => weak[0]?.concept.id ?? "",
  );

  const conceptIds = weak.map((w) => w.concept.id);
  const activeId = conceptIds.includes(selectedId)
    ? selectedId
    : conceptIds[0] ?? "";

  const chartData = useMemo(() => {
    if (!activeId) return [];

    const obs = skillProfile.observations
      .filter((o) => o.conceptId === activeId)
      .sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());

    let strength = 0;
    let weakness = 0;

    return obs.map((o) => {
      if (o.polarity === "strength") strength++;
      else weakness++;
      const trend = 50 + strength * 8 - weakness * 12;
      const mastery = Math.max(0, Math.min(100, trend));
      return {
        date: formatDateISO(parseISO(o.observedAt)),
        mastery,
        polarity: o.polarity,
      };
    });
  }, [skillProfile.observations, activeId]);

  if (weak.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Concept Mastery Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Concept trends appear once weaknesses are identified from graded sessions.
          </p>
        </CardContent>
      </Card>
    );
  }

  const label = getConceptById(skillProfile, activeId)?.label ?? activeId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Concept Mastery Trend</CardTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          {weak.map(({ concept }) => (
            <button
              key={concept.id}
              type="button"
              onClick={() => setSelectedId(concept.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                activeId === concept.id
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {concept.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-500">No observations yet for {label}.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="mastery"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name={`${label} mastery`}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
