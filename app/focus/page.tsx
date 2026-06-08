"use client";

import { useMemo, useState } from "react";
import { ConceptSessionModal } from "@/components/session/ConceptSessionModal";
import { FocusAnalysisPanel } from "@/components/focus/FocusAnalysisPanel";
import { FocusAssessmentBandsPanel } from "@/components/focus/FocusAssessmentBandsPanel";
import { FocusPracticePriorityPanel } from "@/components/focus/FocusPracticePriorityPanel";
import { FocusSessionModal } from "@/components/focus/FocusSessionModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStudyStore } from "@/hooks/useStudyStore";
import {
  DRILL_QUOTA_PER_CONCEPT,
  ensureFocusModel,
  GRADUATION_MASTERY_THRESHOLD,
  isDrillQuotaMet,
} from "@/lib/focus-selection";
import {
  computeConceptPriorities,
  computeRollingPracticeWindow,
  getPracticeSharePercent,
} from "@/lib/focus-priority";
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
  const graded = useStudyStore((s) => s.graded);
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

  const rollingWindow = useMemo(() => {
    const priorities = computeConceptPriorities(
      skillProfile,
      graded,
      focusModel,
    );
    return computeRollingPracticeWindow(priorities, skillProfile, focusModel);
  }, [skillProfile, graded, focusModel]);

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
        const practiceShare = getPracticeSharePercent(conceptId, rollingWindow);
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
          practiceShare,
        };
      }),
    [activeFocus, focusModel, skillProfile, rollingWindow],
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Focused Mastery</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Work on your highest-priority writing concepts in a rolling window.
          Calendar writing exercises already feed your skill profile — you do
          not need to repeat that work here.
        </p>
      </div>

      <Tabs defaultValue="focus-set">
        <TabsList className="inline-flex h-auto w-fit max-w-full flex-wrap gap-1">
          <TabsTrigger value="focus-set">Focus Set</TabsTrigger>
          <TabsTrigger value="focus-history">Focus History</TabsTrigger>
          <TabsTrigger value="assessment-bands">Assessment Bands</TabsTrigger>
          <TabsTrigger value="practice-priority">Practice Priority</TabsTrigger>
        </TabsList>

        <TabsContent value="focus-set">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Focus Set</CardTitle>
              <p className="text-sm text-gray-600">
                Your <strong>focus set</strong> is the 2–3 concepts you are
                actively working on right now — drills, assessments, and
                graduation all target this set. It is chosen from your practice
                priority ranking and updates when concepts graduate.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {focusCards.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No active focus concepts yet. Take an initial assessment or
                  check Practice Priority — calendar writing data may already
                  inform your ranking.
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
                        {card.practiceShare > 0 && (
                          <p className="text-xs text-blue-700">
                            Recommended practice share:{" "}
                            {card.practiceShare.toFixed(0)}%
                          </p>
                        )}
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
            <div className="mt-4 space-y-4">
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
        </TabsContent>

        <TabsContent value="focus-history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Focus History</CardTitle>
              <p className="text-sm text-gray-600">
                <strong>Focus history</strong> is the archive of past focus
                cycles — each entry records which concepts were in a set, when
                you started, and when you graduated them. Your current focus set
                is the active cycle; history shows completed journeys.
              </p>
            </CardHeader>
            <CardContent>
              {focusModel.focusHistory.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No focus cycles yet. Complete an assessment to start your
                  first set.
                </p>
              ) : (
                <ul className="space-y-2 text-sm text-gray-700">
                  {[...focusModel.focusHistory].reverse().map((entry, index) => (
                    <li
                      key={`${entry.startedAt}-${index}`}
                      className="rounded-lg border border-gray-100 px-3 py-2"
                    >
                      <p className="font-medium">
                        {entry.conceptIds
                          .map(
                            (id) =>
                              getConceptById(skillProfile, id)?.label ?? id,
                          )
                          .join(", ")}
                      </p>
                      <p className="text-xs text-gray-500">
                        Started {new Date(entry.startedAt).toLocaleDateString()}
                        {entry.graduatedAt
                          ? ` · Graduated ${new Date(entry.graduatedAt).toLocaleDateString()}`
                          : " · In progress"}
                      </p>
                      {entry.rationale && (
                        <p className="mt-1 text-xs text-gray-600">
                          {entry.rationale}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessment-bands">
          <FocusAssessmentBandsPanel />
        </TabsContent>

        <TabsContent value="practice-priority">
          <FocusPracticePriorityPanel />
        </TabsContent>
      </Tabs>

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
