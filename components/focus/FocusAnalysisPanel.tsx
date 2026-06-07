"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudyStore } from "@/hooks/useStudyStore";
import type { FocusGradeAnalysis } from "@/lib/focus-grade-analysis";
import { getConceptById } from "@/lib/skill-profile";

interface FocusAnalysisPanelProps {
  analysis: FocusGradeAnalysis;
  graduatedIds?: string[];
}

export function FocusAnalysisPanel({
  analysis,
  graduatedIds = [],
}: FocusAnalysisPanelProps) {
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const selectedSet = new Set(analysis.selectedFocusIds);
  const graduatedSet = new Set(graduatedIds);

  if (analysis.weaknesses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Focus Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            No concept weaknesses were tagged in this submission. Try a longer
            response or run another assessment.
          </p>
        </CardContent>
      </Card>
    );
  }

  const otherRanked = analysis.rankedCandidates.filter(
    (entry) => !selectedSet.has(entry.conceptId),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Focus Analysis</CardTitle>
        <p className="text-sm text-gray-600">
          Concepts detected in your writing, ranked by lowest-hanging-fruit
          score (CELPIP impact, exam frequency, errors in this draft, and
          current mastery).
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Concepts identified ({analysis.weaknesses.length})
          </h3>
          <ul className="mt-2 space-y-2">
            {analysis.weaknesses.map((weakness) => {
              const concept = getConceptById(skillProfile, weakness.conceptId);
              const rank = analysis.rankedCandidates.find(
                (entry) => entry.conceptId === weakness.conceptId,
              );
              return (
                <li
                  key={weakness.conceptId}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {concept?.label ?? weakness.label}
                    </span>
                    {rank && (
                      <Badge variant="outline" className="text-xs">
                        Priority score {rank.score.toFixed(1)}
                      </Badge>
                    )}
                    {selectedSet.has(weakness.conceptId) && (
                      <Badge className="bg-blue-600 text-xs text-white">
                        Low-hanging fruit
                      </Badge>
                    )}
                    {graduatedSet.has(weakness.conceptId) && (
                      <Badge variant="outline" className="text-xs text-emerald-700">
                        Graduated
                      </Badge>
                    )}
                  </div>
                  {weakness.evidence && (
                    <p className="mt-1 text-xs italic text-gray-600">
                      &ldquo;{weakness.evidence}&rdquo;
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {analysis.selectedFocusIds.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-blue-900">
              Recommended focus set — work on these next
            </h3>
            <p className="mt-1 text-xs text-gray-600">
              Pick 2–3 concepts with the best score lift for effort. Practice
              drills for each before your next assessment.
            </p>
            <div className="mt-3 space-y-3">
              {analysis.selectedRationale.map((entry, index) => {
                const concept = getConceptById(skillProfile, entry.conceptId);
                return (
                  <div
                    key={entry.conceptId}
                    className="rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                        #{index + 1}
                      </span>
                      <span className="font-medium text-blue-950">
                        {concept?.label ?? entry.conceptId.replace(/_/g, " ")}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Score {entry.score.toFixed(1)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-gray-700">{entry.rationale}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      Est. score impact {entry.estimatedScoreImpact}/5 · Est.
                      effort {entry.estimatedEffort}/5
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {otherRanked.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              Lower priority for now
            </h3>
            <ul className="mt-2 space-y-2">
              {otherRanked.map((entry) => {
                const concept = getConceptById(skillProfile, entry.conceptId);
                return (
                  <li
                    key={entry.conceptId}
                    className="rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-700"
                  >
                    <span className="font-medium">
                      {concept?.label ?? entry.conceptId.replace(/_/g, " ")}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      Score {entry.score.toFixed(1)}
                    </span>
                    <p className="mt-1 text-xs text-gray-600">{entry.rationale}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
