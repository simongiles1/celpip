"use client";

import { useMemo, useState } from "react";
import { ConceptSessionModal } from "@/components/session/ConceptSessionModal";
import { FocusAnalysisPanel } from "@/components/focus/FocusAnalysisPanel";
import { FocusScoreTimeline } from "@/components/focus/FocusScoreTimeline";
import { FocusSessionModal } from "@/components/focus/FocusSessionModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudyStore } from "@/hooks/useStudyStore";
import {
  DRILL_QUOTA_PER_CONCEPT,
  ensureFocusModel,
  GRADUATION_MASTERY_THRESHOLD,
  isDrillQuotaMet,
} from "@/lib/focus-selection";
import { getConceptById } from "@/lib/skill-profile";
import type { FocusGradeAnalysis } from "@/lib/focus-grade-analysis";
import type { FocusSelectionRationale, GradeResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

function MasteryBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-gray-200", className)}>
      <div
        className="h-full rounded-full bg-blue-600 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default function FocusPage() {
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const recordFocusPractice = useStudyStore((s) => s.recordFocusPractice);

  const focusModel = ensureFocusModel(skillProfile);
  const activeFocus = focusModel.activeFocus;

  const [practiceConceptId, setPracticeConceptId] = useState<string | null>(
    null,
  );
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [overrideQuota, setOverrideQuota] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<{
    grade: GradeResponse;
    graduated: string[];
    nextFocus: string[];
    rationale: FocusSelectionRationale[];
    analysis: FocusGradeAnalysis;
  } | null>(null);

  const quotaMet = isDrillQuotaMet(focusModel, activeFocus);
  const canAssess =
    activeFocus.length === 0 || quotaMet || overrideQuota;

  const focusCards = useMemo(
    () =>
      activeFocus.map((conceptId) => {
        const concept = getConceptById(skillProfile, conceptId);
        const score = skillProfile.conceptScores.find(
          (s) => s.conceptId === conceptId,
        );
        const completed = focusModel.practiceCompleted[conceptId] ?? 0;
        const baseline = focusModel.baselineByConcept[conceptId];
        return {
          conceptId,
          label: concept?.label ?? conceptId.replace(/_/g, " "),
          description: concept?.description ?? "",
          mastery: score?.mastery ?? 50,
          baselineMastery: baseline?.mastery,
          drillProgress: Math.min(
            100,
            (completed / DRILL_QUOTA_PER_CONCEPT) * 100,
          ),
          drillCompleted: completed,
        };
      }),
    [activeFocus, focusModel, skillProfile],
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Focused Mastery</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Work on 2–3 lowest-hanging-fruit concepts at a time. Complete focused
          drills, then take a CELPIP-style assessment to measure progress before
          moving on.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Focus Set</CardTitle>
          <p className="text-sm text-gray-600">
            {activeFocus.length === 0
              ? "Take an initial assessment to discover your first focus concepts."
              : `Practise each concept ${DRILL_QUOTA_PER_CONCEPT} times before the next assessment.`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {focusCards.length === 0 ? (
            <p className="text-sm text-gray-500">
              No active focus concepts yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {focusCards.map((card) => (
                <Card key={card.conceptId} className="border-blue-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{card.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="line-clamp-2 text-xs text-gray-600">
                      {card.description}
                    </p>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-gray-500">
                        <span>Mastery</span>
                        <span>{card.mastery}%</span>
                      </div>
                      <MasteryBar value={card.mastery} />
                      {card.baselineMastery != null && (
                        <p className="mt-1 text-xs text-gray-500">
                          Baseline: {card.baselineMastery}% · Graduate at{" "}
                          {GRADUATION_MASTERY_THRESHOLD}%
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-gray-500">
                        <span>Drill quota</span>
                        <span>
                          {card.drillCompleted}/{DRILL_QUOTA_PER_CONCEPT}
                        </span>
                      </div>
                      <MasteryBar value={card.drillProgress} />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setPracticeConceptId(card.conceptId)}
                    >
                      Practice
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
            <Button
              type="button"
              onClick={() => {
                setLastOutcome(null);
                setAssessmentOpen(true);
              }}
              disabled={!canAssess}
            >
              {activeFocus.length === 0
                ? "Take Initial Assessment"
                : "Take Focused Assessment"}
            </Button>
            {activeFocus.length > 0 && !quotaMet && (
              <>
                <p className="text-xs text-amber-700">
                  Complete drill quota for all focus concepts to unlock
                  assessment.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOverrideQuota(true)}
                >
                  Override gate
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {lastOutcome && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600">Band</span>
                <Badge variant="success">{lastOutcome.grade.estimatedBand}</Badge>
              </div>
            </CardContent>
          </Card>
          <FocusAnalysisPanel
            analysis={lastOutcome.analysis}
            graduatedIds={lastOutcome.graduated}
          />
        </div>
      )}

      {focusModel.focusHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Focus History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              {[...focusModel.focusHistory].reverse().map((entry, index) => (
                <li
                  key={`${entry.startedAt}-${index}`}
                  className="rounded-lg border border-gray-100 px-3 py-2"
                >
                  <p className="font-medium">
                    {entry.conceptIds
                      .map((id) => getConceptById(skillProfile, id)?.label ?? id)
                      .join(", ")}
                  </p>
                  <p className="text-xs text-gray-500">
                    Started {new Date(entry.startedAt).toLocaleDateString()}
                    {entry.graduatedAt
                      ? ` · Graduated ${new Date(entry.graduatedAt).toLocaleDateString()}`
                      : " · In progress"}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <FocusScoreTimeline />

      <ConceptSessionModal
        conceptId={practiceConceptId}
        onClose={() => setPracticeConceptId(null)}
        onDrillCompleted={(conceptId) => recordFocusPractice(conceptId)}
      />

      <FocusSessionModal
        open={assessmentOpen}
        onClose={() => setAssessmentOpen(false)}
        onPracticeConcept={(conceptId) => {
          setAssessmentOpen(false);
          setPracticeConceptId(conceptId);
        }}
        onGradeComplete={(outcome) => {
          setLastOutcome(outcome);
          setOverrideQuota(false);
        }}
      />
    </main>
  );
}
