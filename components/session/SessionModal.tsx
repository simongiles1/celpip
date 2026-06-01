"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConceptPractice } from "@/components/session/ConceptPractice";
import {
  ConceptChatButton,
  ConceptChatPanel,
} from "@/components/session/ConceptChatPanel";
import { ExerciseKindBadge } from "@/components/session/ExerciseKindBadge";
import { GeminiCostPopover } from "@/components/session/GeminiCostPopover";
import { ConceptSessionModal } from "@/components/session/ConceptSessionModal";
import { GradingResults } from "@/components/session/GradingResults";
import { ReadingSessionContent } from "@/components/session/ReadingSessionContent";
import { WritingPractice } from "@/components/session/WritingPractice";
import { useSelectedEvent, useStudyStore } from "@/hooks/useStudyStore";
import { useConceptChat } from "@/hooks/useConceptChat";
import {
  appendConceptGradeMetadata,
  getStoredConceptScore,
  getStoredConceptTimings,
  parseConceptSubmission,
} from "@/lib/concept-submission";
import { getSessionDurationSeconds } from "@/lib/concept-analytics";
import {
  buildConceptGradeRequestBody,
  formatConceptDrillSubmission,
} from "@/lib/concept-drill-mc";
import {
  formatQuestionSetLabel,
  getConceptSetScore,
} from "@/lib/concept-question-sets";
import { combineGeminiUsage } from "@/lib/gemini-session-usage";
import type { GeminiCostBreakdown } from "@/lib/gemini-usage";
import { getExerciseKindForUnit } from "@/lib/exercise-types";
import { getConceptById, getSkillTagsForEvent, getStrongConcepts, getWeakConcepts } from "@/lib/skill-profile";
import type {
  ConceptDrillItem,
  CurriculumUnit,
  GenerateResponse,
  GradeResponse,
  SessionMode,
  StudyEvent,
} from "@/lib/types";

interface ConceptGenerateOverrides {
  conceptDescriptionOverride?: string;
  conceptDrillConstraintsOverride?: string;
}

function SessionModalContent({
  event,
  unit,
  onUsageChange,
  conceptDocument,
  generateOverrides,
  onDrillItemsChange,
  onPracticeConcept,
}: {
  event: StudyEvent;
  unit: CurriculumUnit;
  onUsageChange: (usage: GeminiCostBreakdown | null) => void;
  conceptDocument?: string;
  generateOverrides?: ConceptGenerateOverrides;
  onDrillItemsChange?: (items: ConceptDrillItem[]) => void;
  onPracticeConcept?: (conceptId: string) => void;
}) {
  const addGenerated = useStudyStore((s) => s.addGenerated);
  const getGeneratedForEvent = useStudyStore((s) => s.getGeneratedForEvent);
  const addGraded = useStudyStore((s) => s.addGraded);
  const getGradedForEvent = useStudyStore((s) => s.getGradedForEvent);
  const markEventCompleted = useStudyStore((s) => s.markEventCompleted);
  const geminiModel = useStudyStore((s) => s.geminiModel);
  const skillProfile = useStudyStore((s) => s.skillProfile);

  const existingGrade = getGradedForEvent(event.id);
  const cached = getGeneratedForEvent(event.id);
  const isReading = unit.focusSubTest === "Reading";
  const isConceptUnit = unit.focusSubTest === "Concept";
  const conceptSaved =
    isConceptUnit && typeof existingGrade?.studentSubmission === "string"
      ? parseConceptSubmission(existingGrade.studentSubmission)
      : null;

  const [content, setContent] = useState<GenerateResponse | null>(
    cached
      ? {
          instructions: cached.instructions,
          example: cached.example,
          examPrompt: cached.examPrompt,
          readingQuestions: cached.readingQuestions,
          conceptDrillItems: cached.conceptDrillItems,
        }
      : null,
  );
  const [loading, setLoading] = useState(!cached && !isReading);
  const [error, setError] = useState<string | null>(null);
  const [writingText, setWritingText] = useState(
    !isConceptUnit && typeof existingGrade?.studentSubmission === "string"
      ? existingGrade.studentSubmission
      : "",
  );
  const [drillResponses, setDrillResponses] = useState<string[]>(
    conceptSaved?.drillAnswers ?? [],
  );
  const [questionTimings, setQuestionTimings] = useState<Record<string, number>>(
    () =>
      isConceptUnit &&
      typeof existingGrade?.studentSubmission === "string" &&
      conceptSaved?.gradeMetadata
        ? getStoredConceptTimings(existingGrade.studentSubmission)
        : {},
  );
  const [initialSessionDurationSeconds, setInitialSessionDurationSeconds] =
    useState<number | null>(() => {
      if (
        !isConceptUnit ||
        typeof existingGrade?.studentSubmission !== "string" ||
        !conceptSaved?.gradeMetadata
      ) {
        return null;
      }
      const timings = getStoredConceptTimings(existingGrade.studentSubmission);
      return getSessionDurationSeconds(conceptSaved.gradeMetadata, timings);
    });
  const [submitting, setSubmitting] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResponse | null>(() => {
    if (!existingGrade) return null;
    if (isConceptUnit && typeof existingGrade.studentSubmission === "string") {
      const saved = parseConceptSubmission(existingGrade.studentSubmission);
      if (saved.gradeMetadata) {
        return {
          estimatedBand: saved.gradeMetadata.estimatedBand,
          overallFeedback: existingGrade.overallFeedback,
          positives: existingGrade.positives,
          constructiveCriticism: existingGrade.constructiveCriticism,
          grammarCorrections: existingGrade.grammarCorrections,
          drillResults: saved.gradeMetadata.drillResults,
          writingResult: saved.gradeMetadata.writingResult,
        };
      }
      return null;
    }
    return {
      estimatedBand: existingGrade.estimatedBand,
      overallFeedback: existingGrade.overallFeedback,
      positives: existingGrade.positives,
      constructiveCriticism: existingGrade.constructiveCriticism,
      grammarCorrections: existingGrade.grammarCorrections,
      skillTags: getSkillTagsForEvent(skillProfile, event.id),
    };
  });
  const [generateUsage, setGenerateUsage] = useState<
    GeminiCostBreakdown | undefined
  >(cached?.geminiUsage);
  const [gradeUsage, setGradeUsage] = useState<GeminiCostBreakdown | undefined>(
    existingGrade?.geminiUsage,
  );
  const generateInFlight = useRef(false);

  useEffect(() => {
    onUsageChange(
      combineGeminiUsage(geminiModel, generateUsage, gradeUsage),
    );
  }, [generateUsage, gradeUsage, geminiModel, onUsageChange]);

  const isExam = unit.focusSubTest === "EXAM";
  const isConcept = unit.focusSubTest === "Concept";
  const drillItems = content?.conceptDrillItems ?? [];

  useEffect(() => {
    if (drillItems.length && drillResponses.length === 0) {
      setDrillResponses(Array(drillItems.length).fill(""));
    }
  }, [drillItems.length, drillResponses.length]);

  useEffect(() => {
    if (isConcept) {
      onDrillItemsChange?.(drillItems);
    }
  }, [isConcept, drillItems, onDrillItemsChange]);

  const sessionMode: SessionMode = isConcept
    ? "concept"
    : unit.id === "w4rev-mon" || unit.practiceType === "Custom Generation"
      ? "review"
      : "subtest";

  const fetchContent = useCallback(async () => {
    if (isExam || isReading || cached) return;
    if (generateInFlight.current) return;
    generateInFlight.current = true;
    setLoading(true);
    setError(null);

    const weak = getWeakConcepts(skillProfile, 5).map(({ concept }) => ({
      id: concept.id,
      label: concept.label,
      evidence: skillProfile.observations.find(
        (o) => o.conceptId === concept.id && o.polarity === "weakness",
      )?.evidence,
    }));
    const strong = getStrongConcepts(skillProfile, 3).map(({ concept }) => ({
      id: concept.id,
      label: concept.label,
    }));

    const conceptMeta = event.conceptId
      ? getConceptById(skillProfile, event.conceptId)
      : undefined;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focusSubTest: unit.focusSubTest,
          focusTarget: unit.focusTarget,
          practiceType: unit.practiceType,
          sessionMode,
          targetConceptId: event.conceptId ?? conceptMeta?.id,
          targetConceptLabel: conceptMeta?.label ?? unit.focusTarget,
          targetConceptDescription:
            generateOverrides?.conceptDescriptionOverride ??
            conceptMeta?.description ??
            unit.grammarFocus,
          conceptExercisesOnly: isConcept,
          conceptSetNumber: 1,
          ...generateOverrides,
          weakConcepts: weak,
          strongConcepts: strong,
          model: geminiModel,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to generate practice content");
      }

      const data = (await res.json()) as GenerateResponse;
      setContent(data);
      setGenerateUsage(data.geminiUsage);
      if (data.conceptDrillItems?.length) {
        setDrillResponses(Array(data.conceptDrillItems.length).fill(""));
        setQuestionTimings({});
        setInitialSessionDurationSeconds(null);
        setGradeResult(null);
      }
      addGenerated({
        eventId: event.id,
        instructions: data.instructions,
        example: data.example,
        examPrompt: data.examPrompt,
        readingQuestions: data.readingQuestions,
        conceptDrillItems: data.conceptDrillItems,
        conceptId: event.conceptId,
        generatedAt: new Date().toISOString(),
        geminiUsage: data.geminiUsage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
      generateInFlight.current = false;
    }
  }, [
    isExam,
    cached,
    unit,
    event.id,
    event.conceptId,
    addGenerated,
    geminiModel,
    skillProfile,
    sessionMode,
    generateOverrides,
    isConcept,
    isReading,
  ]);

  useEffect(() => {
    if (!isExam && !cached && !isReading) {
      void fetchContent();
    }
  }, [isExam, cached, isReading, fetchContent]);

  const persistGrade = (result: GradeResponse, submission: string | Record<string, number>, track: "subtest" | "concept") => {
    setGradeResult(result);
    setGradeUsage(result.geminiUsage);
    addGraded(
      {
        eventId: event.id,
        curriculumUnitId: unit.id,
        focusSubTest: unit.focusSubTest,
        estimatedBand: result.estimatedBand,
        overallFeedback: result.overallFeedback,
        positives: result.positives,
        constructiveCriticism: result.constructiveCriticism,
        grammarCorrections: result.grammarCorrections,
        studentSubmission: submission,
        gradedAt: new Date().toISOString(),
        geminiUsage: result.geminiUsage,
        examPrompt: content?.examPrompt,
      },
      result,
      track,
    );
    markEventCompleted(event.id);
  };

  const handleSubmitWriting = async () => {
    if (!content) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focusSubTest: unit.focusSubTest,
          examPrompt: content.examPrompt,
          studentSubmission: writingText,
          model: geminiModel,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Grading failed");
      }

      const result = (await res.json()) as GradeResponse;
      persistGrade(result, writingText, "subtest");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitConcept = async (
    submittedTimings: Record<string, number>,
    sessionDurationSeconds: number,
  ) => {
    if (!content) return;
    setSubmitting(true);
    setError(null);
    setQuestionTimings(submittedTimings);
    setInitialSessionDurationSeconds(sessionDurationSeconds);

    const conceptMeta = event.conceptId
      ? getConceptById(skillProfile, event.conceptId)
      : undefined;
    const drillBlock = formatConceptDrillSubmission(drillItems, drillResponses);
    const baseSubmission = drillBlock.baseSubmission;

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildConceptGradeRequestBody({
            conceptLabel: conceptMeta?.label ?? unit.focusTarget,
            drillItems,
            drillResponses,
            model: geminiModel,
          }),
        ),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Grading failed");
      }

      const result = (await res.json()) as GradeResponse;
      const fullSubmission = appendConceptGradeMetadata(
        baseSubmission,
        result,
        drillItems.length,
        { questionTimings: submittedTimings, sessionDurationSeconds },
      );
      const gradedDrillResults = result.drillResults?.map((drillResult) => {
        const timeSpentSeconds = submittedTimings[String(drillResult.index)];
        if (timeSpentSeconds == null || !Number.isFinite(timeSpentSeconds)) {
          return drillResult;
        }
        return {
          ...drillResult,
          timeSpentSeconds: Math.max(0, Math.round(timeSpentSeconds)),
        };
      });
      persistGrade(
        {
          ...result,
          drillResults: gradedDrillResults,
        },
        fullSubmission,
        "concept",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (isExam) {
    return (
      <div className="space-y-4 py-4 text-center">
        <p className="text-2xl font-bold text-red-600">Official CELPIP Exam Day</p>
        <p className="text-gray-600">{unit.strategy}</p>
        <p className="text-sm text-gray-500">
          Rest well, arrive early, and trust your preparation. Good luck achieving CLB 9+!
        </p>
      </div>
    );
  }

  if (isReading) {
    return (
      <ReadingSessionContent
        event={event}
        unit={unit}
        onUsageChange={onUsageChange}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="space-y-4 py-4 text-center">
        <p className="text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => void fetchContent()}
          className="text-sm text-blue-600 hover:underline"
        >
          Retry generation
        </button>
      </div>
    );
  }

  if (!content) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {gradeResult && !isConcept ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <GradingResults
            result={gradeResult}
            eventId={event.id}
            skillProfile={skillProfile}
            onPracticeConcept={onPracticeConcept}
            verificationCopy={
              content
                ? {
                    testLabel: `${unit.practiceType} — ${unit.focusTarget}`,
                    examPrompt: content.examPrompt,
                    studentResponse: writingText,
                  }
                : undefined
            }
          />
        </div>
      ) : isConcept ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConceptPractice
            conceptId={event.conceptId}
            document={
              conceptDocument ??
              content.instructions
            }
            questionSets={[
              {
                setNumber: 1,
                label: formatQuestionSetLabel(
                  1,
                  typeof existingGrade?.studentSubmission === "string"
                    ? getStoredConceptScore(existingGrade.studentSubmission) ??
                        getConceptSetScore(gradeResult, drillItems.length)
                    : getConceptSetScore(gradeResult, drillItems.length),
                ),
                isActive: true,
              },
            ]}
            onSelectQuestionSet={() => {}}
            onNewQuestionSet={() => {}}
            allowNewQuestionSets={false}
            drillItems={drillItems}
            drillResponses={drillResponses}
            onDrillChange={(index, value) => {
              setDrillResponses((prev) => {
                const next = [...prev];
                next[index] = value;
                return next;
              });
            }}
            onSubmit={handleSubmitConcept}
            submitting={submitting}
            gradeResult={gradeResult}
            initialQuestionTimings={questionTimings}
            initialSessionDurationSeconds={initialSessionDurationSeconds}
          />
        </div>
      ) : (
        <WritingPractice
          instructions={content.instructions}
          example={content.example}
          examPrompt={content.examPrompt}
          practiceType={unit.practiceType}
          focusTarget={unit.focusTarget}
          sessionGoal={unit.sessionGoal}
          grammarFocus={unit.grammarFocus}
          strategy={unit.strategy}
          value={writingText}
          onChange={setWritingText}
          onSubmit={handleSubmitWriting}
          submitting={submitting}
        />
      )}
      {error && <p className="mt-3 shrink-0 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function SessionModal() {
  const selectedEventId = useStudyStore((s) => s.selectedEventId);
  const setSelectedEventId = useStudyStore((s) => s.setSelectedEventId);
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const geminiModel = useStudyStore((s) => s.geminiModel);
  const { event, unit } = useSelectedEvent();
  const [contentUsage, setContentUsage] = useState<GeminiCostBreakdown | null>(
    null,
  );
  const [chatUsage, setChatUsage] = useState<GeminiCostBreakdown | undefined>();
  const [sessionUsage, setSessionUsage] = useState<GeminiCostBreakdown | null>(
    null,
  );
  const [conceptDrillItems, setConceptDrillItems] = useState<ConceptDrillItem[]>(
    [],
  );
  const [practiceConceptId, setPracticeConceptId] = useState<string | null>(null);

  const isConceptSession = unit?.focusSubTest === "Concept";
  const isVocabularySession = unit?.focusSubTest === "Vocabulary";
  const concept =
    isConceptSession && event?.conceptId
      ? getConceptById(skillProfile, event.conceptId)
      : undefined;

  const {
    chatOpen,
    setChatOpen,
    sending: chatSending,
    chatError,
    messages: chatMessages,
    sendMessage,
    conceptDocument,
    generateOverrides,
  } = useConceptChat({
    concept,
    drillItems: conceptDrillItems,
    onUsage: setChatUsage,
  });

  const open = Boolean(selectedEventId && event && unit && !isVocabularySession);
  const exerciseKind = unit ? getExerciseKindForUnit(unit) : null;

  useEffect(() => {
    if (!open) {
      setContentUsage(null);
      setChatUsage(undefined);
      setConceptDrillItems([]);
    }
  }, [open]);

  useEffect(() => {
    setSessionUsage(
      combineGeminiUsage(
        geminiModel,
        contentUsage ?? undefined,
        chatUsage,
      ),
    );
  }, [contentUsage, chatUsage, geminiModel]);

  const handleDrillItemsChange = useCallback((items: ConceptDrillItem[]) => {
    setConceptDrillItems(items);
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && setSelectedEventId(null)}>
      {event && unit && (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <DialogHeader
            onClose={() => setSelectedEventId(null)}
            className="px-6 py-3"
            trailing={
              isConceptSession && concept ? (
                <>
                  <ConceptChatButton onClick={() => setChatOpen(true)} />
                  <GeminiCostPopover usage={sessionUsage} />
                </>
              ) : (
                <GeminiCostPopover usage={sessionUsage} />
              )
            }
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{unit.focusSubTest}</Badge>
                {exerciseKind && <ExerciseKindBadge kind={exerciseKind} />}
                <Badge variant="outline">Week {unit.week}</Badge>
                {event.status === "completed" && (
                  <Badge variant="success">Completed</Badge>
                )}
              </div>
              <DialogTitle>{unit.focusTarget}</DialogTitle>
              {exerciseKind === "themed" && (
                <p className="text-sm text-gray-500">
                  Themed practice from your study plan — skill work, not an
                  official CELPIP test item.
                </p>
              )}
            </div>
          </DialogHeader>

          <DialogContent>
            <SessionModalContent
              key={event.id}
              event={event}
              unit={unit}
              onUsageChange={setContentUsage}
              conceptDocument={isConceptSession ? conceptDocument : undefined}
              generateOverrides={isConceptSession ? generateOverrides : undefined}
              onDrillItemsChange={
                isConceptSession ? handleDrillItemsChange : undefined
              }
              onPracticeConcept={setPracticeConceptId}
            />
            {chatError && (
              <p className="mt-3 text-sm text-red-600">{chatError}</p>
            )}
          </DialogContent>

          {isConceptSession && concept && (
            <ConceptChatPanel
              open={chatOpen}
              onOpenChange={setChatOpen}
              conceptLabel={concept.label}
              messages={chatMessages}
              onSend={sendMessage}
              sending={chatSending}
            />
          )}
        </div>
      )}
      </Dialog>
      <ConceptSessionModal
        conceptId={practiceConceptId}
        onClose={() => setPracticeConceptId(null)}
      />
    </>
  );
}
