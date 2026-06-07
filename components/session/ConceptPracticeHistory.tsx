"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStudyStore } from "@/hooks/useStudyStore";
import {
  formatConceptDuration,
  getConceptPracticeChartData,
  getConceptPracticeHistory,
  type ConceptPracticeAttempt,
} from "@/lib/concept-analytics";

interface ConceptPracticeHistoryProps {
  conceptId: string;
  variant?: "tab" | "standalone";
}

type HistoryView = "graph" | "list";

function HistoryViewToggle({
  view,
  onChange,
}: {
  view: HistoryView;
  onChange: (view: HistoryView) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
      <Button
        type="button"
        size="sm"
        variant={view === "graph" ? "default" : "ghost"}
        className={cn("h-7 px-3 text-xs", view === "graph" && "cursor-default")}
        onClick={() => {
          if (view !== "graph") onChange("graph");
        }}
      >
        Graph
      </Button>
      <Button
        type="button"
        size="sm"
        variant={view === "list" ? "default" : "ghost"}
        className={cn("h-7 px-3 text-xs", view === "list" && "cursor-default")}
        onClick={() => {
          if (view !== "list") onChange("list");
        }}
      >
        List
      </Button>
    </div>
  );
}

function HistoryList({ history }: { history: ConceptPracticeAttempt[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2 pr-3 font-medium">Date</th>
            <th className="py-2 pr-3 font-medium">Set</th>
            <th className="py-2 pr-3 font-medium">Score</th>
            <th className="py-2 pr-3 font-medium">Total</th>
            <th className="py-2 font-medium">Avg / Q</th>
          </tr>
        </thead>
        <tbody>
          {history.map((attempt) => (
            <tr key={attempt.eventId} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-3 text-gray-700">
                {format(parseISO(attempt.gradedAt), "MMM d, h:mm a")}
              </td>
              <td className="py-2 pr-3 text-gray-700">{attempt.setNumber}</td>
              <td className="py-2 pr-3 text-gray-900">
                {attempt.score
                  ? `${attempt.score.correct}/${attempt.score.total}`
                  : "—"}
              </td>
              <td className="py-2 pr-3 tabular-nums text-gray-700">
                {attempt.totalTimeSeconds != null
                  ? formatConceptDuration(attempt.totalTimeSeconds)
                  : "—"}
              </td>
              <td className="py-2 tabular-nums text-gray-700">
                {attempt.avgTimePerQuestionSeconds != null
                  ? formatConceptDuration(attempt.avgTimePerQuestionSeconds)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryGraph({ history }: { history: ConceptPracticeAttempt[] }) {
  const chartData = useMemo(
    () => getConceptPracticeChartData(history),
    [history],
  );

  const hasScore = chartData.some((point) => point.scorePct != null);
  const hasTiming = chartData.some(
    (point) => point.avgTimePerQuestionSeconds != null,
  );

  if (!hasScore && !hasTiming) {
    return (
      <p className="text-sm text-gray-500">
        Timing data is missing for these attempts. Complete a new set to see score
        and pacing trends.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Score and avg seconds per question over time. Steady score with falling
        time means you are getting faster.
      </p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="attemptLabel" tick={{ fontSize: 11 }} />
            {hasScore && (
              <YAxis
                yAxisId="score"
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `${value}%`}
              />
            )}
            {hasTiming && (
              <YAxis
                yAxisId="time"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `${value}s`}
              />
            )}
            <Tooltip
              formatter={(value, name, props) => {
                if (name === "Score") {
                  return [
                    props.payload.scoreLabel ?? `${value}%`,
                    "Score",
                  ];
                }
                if (name === "Avg / Q") {
                  return [
                    props.payload.avgTimeLabel ?? `${value}s`,
                    "Avg / Q",
                  ];
                }
                return [value, name];
              }}
              labelFormatter={(_label, payload) => {
                const point = payload?.[0]?.payload as
                  | { gradedAt?: string; attemptLabel?: string }
                  | undefined;
                if (!point?.gradedAt) return point?.attemptLabel ?? "";
                return `${point.attemptLabel} · ${format(parseISO(point.gradedAt), "MMM d, h:mm a")}`;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {hasScore && (
              <Line
                yAxisId="score"
                type="monotone"
                dataKey="scorePct"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Score"
                connectNulls
              />
            )}
            {hasTiming && (
              <Line
                yAxisId="time"
                type="monotone"
                dataKey="avgTimePerQuestionSeconds"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Avg / Q"
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ConceptPracticeHistory({
  conceptId,
  variant = "standalone",
}: ConceptPracticeHistoryProps) {
  const graded = useStudyStore((s) => s.graded);
  const [view, setView] = useState<HistoryView>("graph");

  const history = useMemo(
    () => getConceptPracticeHistory(graded, conceptId),
    [graded, conceptId],
  );

  if (history.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No graded attempts yet. Score and time per question will appear here after
        you submit a set.
      </p>
    );
  }

  const latest = history[0];
  const previous = history[1];
  const paceImproved =
    latest.avgTimePerQuestionSeconds != null &&
    previous?.avgTimePerQuestionSeconds != null &&
    latest.avgTimePerQuestionSeconds < previous.avgTimePerQuestionSeconds;
  const scoreHeld =
    latest.score != null &&
    previous?.score != null &&
    latest.score.correct === previous.score.correct &&
    latest.score.total === previous.score.total;

  return (
    <div className="space-y-3">
      {variant === "standalone" && (
        <div>
          <p className="text-sm font-medium text-gray-900">Practice history</p>
          <p className="text-xs text-gray-500">
            Score and pacing for each question set on this concept.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <HistoryViewToggle view={view} onChange={setView} />
          {paceImproved && scoreHeld && (
            <Badge variant="success" className="text-xs">
              Faster at same score
            </Badge>
          )}
        </div>
      </div>

      {view === "graph" ? (
        <HistoryGraph history={history} />
      ) : (
        <HistoryList history={history} />
      )}
    </div>
  );
}
