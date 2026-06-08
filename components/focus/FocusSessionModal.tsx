"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FocusAnalysisPanel } from "@/components/focus/FocusAnalysisPanel";
import { FocusedWritingReview } from "@/components/focus/FocusedWritingReview";
import { WritingPractice } from "@/components/session/WritingPractice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudyStore } from "@/hooks/useStudyStore";
import { buildFocusGradeAnalysis } from "@/lib/focus-grade-analysis";
import { ensureFocusModel } from "@/lib/focus-selection";
import { getConceptById } from "@/lib/skill-profile";
import type { FocusGradeAnalysis } from "@/lib/focus-grade-analysis";
import type { FocusSelectionRationale, GenerateResponse, GradeResponse } from "@/lib/types";

const FOCUS_UNIT_ID = "focus-writing-assessment";
const GENERATE_TIMEOUT_MS = 95_000;

interface FocusConceptContext {
  id: string;
  label: string;
  evidence?: string;
}

interface FocusSessionConfig {
  isInitialAssessment: boolean;
  focusIds: string[];
  focusConcepts: FocusConceptContext[];
}

interface FocusSessionModalProps {
  open: boolean;
  onClose: () => void;
  onGradeComplete?: (result: {
    grade: GradeResponse;
    graduated: string[];
    nextFocus: string[];
    rationale: FocusSelectionRationale[];
    analysis: FocusGradeAnalysis;
  }) => void;
  onPracticeConcept?: (conceptId: string) => void;
  forceOverrideQuota?: boolean;
}

function buildSessionConfig(skillProfile: ReturnType<typeof useStudyStore.getState>["skillProfile"]): FocusSessionConfig {
  const focusIds = [...ensureFocusModel(skillProfile).activeFocus];
  return {
    isInitialAssessment: focusIds.length === 0,
    focusIds,
    focusConcepts: focusIds.map((id) => {
      const concept = getConceptById(skillProfile, id);
      return {
        id,
        label: concept?.label ?? id.replace(/_/g, " "),
        evidence: concept?.description,
      };
    }),
  };
}

export function FocusSessionModal({
  open,
  onClose,
  onGradeComplete,
  onPracticeConcept,
}: FocusSessionModalProps) {
  const geminiModel = useStudyStore((s) => s.geminiModel);
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const addGenerated = useStudyStore((s) => s.addGenerated);
  const completeFocusedAssessment = useStudyStore(
    (s) => s.completeFocusedAssessment,
  );

  const [eventId] = useState(() => `evt-focus-assess-${Date.now()}`);
  const [sessionConfig, setSessionConfig] = useState<FocusSessionConfig | null>(
    null,
  );
  const [content, setContent] = useState<GenerateResponse | null>(null);
  const [writingText, setWritingText] = useState("");
  const [gradeResult, setGradeResult] = useState<GradeResponse | null>(null);
  const [gradeAnalysis, setGradeAnalysis] = useState<FocusGradeAnalysis | null>(
    null,
  );
  const [graduatedIds, setGraduatedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fillingTestResponse, setFillingTestResponse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const openRef = useRef(open);

  const generateAssessment = useCallback(
    async (config: FocusSessionConfig) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        GENERATE_TIMEOUT_MS,
      );

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            focusSubTest: "Writing",
            focusTarget: "Focused Assessment",
            practiceType: config.isInitialAssessment
              ? "Email Task 1"
              : "Survey Task 2",
            mode: "focused",
            focusedWritingTask: config.isInitialAssessment ? "task_1" : "task_2",
            weakConcepts: config.focusConcepts,
            model: geminiModel,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ??
              "Failed to generate assessment",
          );
        }

        const data = (await res.json()) as GenerateResponse;
        if (controller.signal.aborted || !openRef.current) return;

        setContent(data);
        addGenerated({
          eventId,
          instructions: data.instructions,
          example: data.example,
          examPrompt: data.examPrompt,
          generatedAt: new Date().toISOString(),
          geminiUsage: data.geminiUsage,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setError(
            "Generation timed out. Try again or switch to Gemini 2.5 Flash.",
          );
        } else {
          setError(err instanceof Error ? err.message : "Generation failed");
        }
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [addGenerated, eventId, geminiModel],
  );

  useEffect(() => {
    openRef.current = open;

    if (!open) {
      abortRef.current?.abort();
      setSessionConfig(null);
      setContent(null);
      setWritingText("");
      setGradeResult(null);
      setGradeAnalysis(null);
      setGraduatedIds([]);
      setLoading(false);
      setSubmitting(false);
      setFillingTestResponse(false);
      setError(null);
      return;
    }

    const config = buildSessionConfig(
      useStudyStore.getState().skillProfile,
    );
    setSessionConfig(config);
    setContent(null);
    setWritingText("");
    setGradeResult(null);
    setGradeAnalysis(null);
    setGraduatedIds([]);
    setError(null);
    void generateAssessment(config);
  }, [open, generateAssessment]);

  const handleFillTestResponse = async () => {
    if (!content?.examPrompt || !sessionConfig) return;
    setFillingTestResponse(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focusSubTest: "Writing",
          focusTarget: "Focused Assessment",
          practiceType: sessionConfig.isInitialAssessment
            ? "Email Task 1"
            : "Survey Task 2",
          mode: "focused_test_submission",
          examPrompt: content.examPrompt,
          focusedWritingTask: sessionConfig.isInitialAssessment
            ? "task_1"
            : "task_2",
          weakConcepts: sessionConfig.focusConcepts,
          model: geminiModel,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ??
            "Failed to generate test response",
        );
      }

      const data = (await res.json()) as { studentSubmission: string };
      if (!data.studentSubmission?.trim()) {
        throw new Error("Generated test response was empty");
      }
      setWritingText(data.studentSubmission);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate test response",
      );
    } finally {
      setFillingTestResponse(false);
    }
  };

  const handleSubmit = async () => {
    if (!content || !sessionConfig) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focusSubTest: "Writing",
          examPrompt: content.examPrompt,
          studentSubmission: writingText,
          gradingMode: "focused",
          focusConceptIds: sessionConfig.focusIds,
          isInitialFocusAssessment: sessionConfig.isInitialAssessment,
          model: geminiModel,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Grading failed");
      }

      const result = (await res.json()) as GradeResponse;
      const analysis = buildFocusGradeAnalysis(
        useStudyStore.getState().skillProfile,
        result,
        useStudyStore.getState().graded,
      );
      setGradeResult(result);
      setGradeAnalysis(analysis);

      const focusOutcome = await completeFocusedAssessment(
        {
          eventId,
          curriculumUnitId: FOCUS_UNIT_ID,
          focusSubTest: "Writing",
          estimatedBand: result.estimatedBand,
          overallFeedback: result.overallFeedback,
          positives: result.positives,
          constructiveCriticism: result.constructiveCriticism,
          grammarCorrections: result.grammarCorrections,
          studentSubmission: writingText,
          gradedAt: new Date().toISOString(),
          geminiUsage: result.geminiUsage,
          examPrompt: content.examPrompt,
        },
        result,
      );
      setGraduatedIds(focusOutcome.graduated);
      onGradeComplete?.({
        grade: result,
        analysis,
        ...focusOutcome,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed");
    } finally {
      setSubmitting(false);
    }
  };

  const sessionTitle = sessionConfig?.isInitialAssessment
    ? "Initial Focus Assessment"
    : "Focused Re-Assessment";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      slideFromBottom
      panelClassName="w-full max-w-4xl"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogHeader className="shrink-0 px-6 py-4">
          <DialogTitle>{sessionTitle}</DialogTitle>
          <p className="text-sm text-gray-600">
            CELPIP-style writing exercise to measure progress on your current
            focus concepts.
          </p>
          {(sessionConfig?.focusIds.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {sessionConfig!.focusIds.map((id) => {
                const concept = getConceptById(skillProfile, id);
                return (
                  <Badge key={id} variant="outline" className="text-blue-800">
                    {concept?.label ?? id.replace(/_/g, " ")}
                  </Badge>
                );
              })}
            </div>
          )}
        </DialogHeader>

        <DialogContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading && (
            <div className="space-y-3 py-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {!loading && content && !gradeResult && sessionConfig && (
            <div className="flex min-h-0 flex-1 flex-col">
              <WritingPractice
                instructions={content.instructions}
                example={content.example}
                examPrompt={content.examPrompt}
                practiceType={
                  sessionConfig.isInitialAssessment
                    ? "Email Task 1"
                    : "Survey Task 2"
                }
                focusTarget="Focused Assessment"
                sessionGoal="Demonstrate current writing ability for focus selection."
                value={writingText}
                onChange={setWritingText}
                onSubmit={handleSubmit}
                submitting={submitting}
                onFillTestResponse={handleFillTestResponse}
                fillingTestResponse={fillingTestResponse}
                defaultTab="prompt"
              />
            </div>
          )}

          {gradeResult && sessionConfig && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600">
                  Estimated CLB Band
                </span>
                <Badge variant="success" className="text-base px-3 py-1">
                  {gradeResult.estimatedBand}
                </Badge>
              </div>

              <div className="prose prose-sm max-w-none rounded-lg border border-gray-200 p-4">
                <ReactMarkdown>{gradeResult.overallFeedback}</ReactMarkdown>
              </div>

              {gradeAnalysis && (
                <FocusAnalysisPanel
                  analysis={gradeAnalysis}
                  graduatedIds={graduatedIds}
                />
              )}

              <FocusedWritingReview
                studentResponse={writingText}
                corrections={gradeResult.grammarCorrections}
                focusHighlights={gradeResult.focusHighlights ?? []}
                focusConceptIds={sessionConfig.focusIds}
                skillTags={gradeResult.skillTags}
                onPracticeConcept={onPracticeConcept}
              />
            </div>
          )}

          {error && <p className="shrink-0 text-sm text-red-600">{error}</p>}

          <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 pt-3">
            {gradeResult ? (
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
          </div>
        </DialogContent>
      </div>
    </Dialog>
  );
}
