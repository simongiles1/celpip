"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PracticeDistributionChart } from "@/components/focus/PracticeDistributionChart";
import { useStudyStore } from "@/hooks/useStudyStore";
import { ensureFocusModel } from "@/lib/focus-selection";
import {
  buildPracticeDistributionChartData,
  computeConceptPriorities,
  computeRollingPracticeWindow,
  PRACTICE_WINDOW_FUTURE_PREVIEW,
} from "@/lib/focus-priority";
import { getConceptById } from "@/lib/skill-profile";
import { cn } from "@/lib/utils";

function MetricBar({
  value,
  max = 5,
  className,
}: {
  value: number;
  max?: number;
  className?: string;
}) {
  const pct = (value / max) * 100;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-gray-200", className)}>
      <div
        className="h-full rounded-full bg-blue-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

export function FocusPracticePriorityPanel() {
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const graded = useStudyStore((s) => s.graded);
  const focusModel = ensureFocusModel(skillProfile);

  const { priorities, window } = useMemo(() => {
    const ranked = computeConceptPriorities(skillProfile, graded, focusModel);
    const rolling = computeRollingPracticeWindow(
      ranked,
      skillProfile,
      focusModel,
    );
    return { priorities: ranked, window: rolling };
  }, [skillProfile, graded, focusModel]);

  const windowSet = new Set(window.windowConceptIds);
  const chartData = buildPracticeDistributionChartData(priorities, window);
  const chartLabels = Object.fromEntries(
    chartData.map((point) => {
      const concept = getConceptById(skillProfile, point.conceptId);
      return [
        point.conceptId,
        concept?.label ?? point.conceptId.replace(/_/g, " "),
      ];
    }),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Practice Window</CardTitle>
          <p className="text-sm text-gray-600">
            Work on the top {window.windowSize} concepts at a time — not all{" "}
            {priorities.length} at once. Bars show assigned share; the orange
            curve is the Gaussian over the active window plus the next{" "}
            {PRACTICE_WINDOW_FUTURE_PREVIEW} queued concepts (gated to 0 until
            the window expands).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <PracticeDistributionChart
            data={chartData}
            labels={chartLabels}
            meanIndex={window.meanIndex}
            sigma={window.sigma}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Concept Priority Ranking</CardTitle>
          <p className="text-sm text-gray-600">
            Ranked by three metrics: how often the mistake opportunity appears on
            CELPIP writing (AI priors), how often you make the mistake (calendar
            + focus exercises), and how easy the issue is to correct (AI priors,
            adjusted as you practice).
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="pb-2 pr-3 font-medium">#</th>
                  <th className="pb-2 pr-3 font-medium">Concept</th>
                  <th className="pb-2 pr-3 font-medium" title="CELPIP exam frequency">
                    Exam freq.
                  </th>
                  <th className="pb-2 pr-3 font-medium" title="Your mistake rate">
                    Your errors
                  </th>
                  <th className="pb-2 pr-3 font-medium" title="Ease of correction">
                    Ease
                  </th>
                  <th className="pb-2 pr-3 font-medium">Score</th>
                  <th className="pb-2 font-medium">Practice share</th>
                </tr>
              </thead>
              <tbody>
                {priorities.map((entry, index) => {
                  const concept = getConceptById(skillProfile, entry.conceptId);
                  const share = window.distribution.find(
                    (d) => d.conceptId === entry.conceptId,
                  )?.percent;
                  const inWindow = windowSet.has(entry.conceptId);

                  return (
                    <tr
                      key={entry.conceptId}
                      className={cn(
                        "border-b border-gray-100",
                        inWindow && "bg-blue-50/40",
                      )}
                    >
                      <td className="py-3 pr-3 text-gray-500">{index + 1}</td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-gray-900">
                            {concept?.label ?? entry.conceptId.replace(/_/g, " ")}
                          </span>
                          {inWindow && (
                            <Badge className="bg-blue-600 text-[10px] text-white">
                              In window
                            </Badge>
                          )}
                          {focusModel.activeFocus.includes(entry.conceptId) && (
                            <Badge variant="outline" className="text-[10px]">
                              Focus set
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 max-w-md text-xs text-gray-500">
                          {entry.rationale}
                        </p>
                        {entry.mistakeStats.totalInstances > 0 && (
                          <p className="mt-0.5 text-[10px] text-gray-400">
                            Calendar: {entry.mistakeStats.calendarInstances} ·
                            Focus: {entry.mistakeStats.focusInstances} · Drills:{" "}
                            {entry.mistakeStats.conceptDrillInstances}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="w-16">
                          <MetricBar value={entry.examFrequency} />
                          <span className="text-xs text-gray-500">
                            {entry.examFrequency}/5
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="w-16">
                          <MetricBar value={entry.userErrorRate} />
                          <span className="text-xs text-gray-500">
                            {entry.userErrorRate.toFixed(1)}/5
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="w-16">
                          <MetricBar value={entry.easeOfCorrection} />
                          <span className="text-xs text-gray-500">
                            {entry.easeOfCorrection.toFixed(1)}/5
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-medium text-gray-800">
                        {entry.priorityScore.toFixed(1)}
                      </td>
                      <td className="py-3">
                        {share != null && share > 0 ? (
                          <span className="font-medium text-blue-700">
                            {share.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
