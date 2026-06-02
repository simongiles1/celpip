"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReadingPractice } from "@/components/session/ReadingPractice";
import { useStudyStore } from "@/hooks/useStudyStore";
import { combineGeminiUsage } from "@/lib/gemini-session-usage";
import type { GeminiCostBreakdown } from "@/lib/gemini-usage";
import {
  getReadingPassageScore,
  formatPassageLabel,
  getBasePassageSet,
  getGeneratedPassagesForEvent,
  getNextPassageSetNumber,
  getStoredReadingPassageScore,
  hasReadingPassageAnswers,
  readingPassageEventId,
} from "@/lib/reading-passage-sets";
import {
  buildReadingResults,
  buildReadingSubmissionEnvelope,
  getReadingAnswers,
  getReadingGradeMetadata,
} from "@/lib/reading-submission";
import { getStrongConcepts, getWeakConcepts } from "@/lib/skill-profile";
import {
  getReadingQuestionsForDisplay,
  READING_ANSWER_INDEX_REPAIR_VERSION,
} from "@/lib/repair-reading-answer-indices";
import type {
  CurriculumUnit,
  GenerateResponse,
  GradeResponse,
  ReadingQuestion,
  SessionMode,
  StudyEvent,
} from "@/lib/types";

function clampClb(value: number): number {
  if (!Number.isFinite(value)) return 9;
  return Math.max(6, Math.min(12, Math.round(value)));
}

function suggestNextClb(
  lastClb: number | undefined,
  lastScore: { correct: number; total: number } | null,
): number | null {
  if (!lastScore || lastScore.total === 0) return null;
  const base = lastClb ?? 9;
  const pct = lastScore.correct / lastScore.total;
  if (pct >= 0.9) return clampClb(base + 1);
  if (pct <= 0.6) return clampClb(base - 1);
  return null;
}

interface ReadingSessionContentProps {
  event: StudyEvent;
  unit: CurriculumUnit;
  onUsageChange: (usage: GeminiCostBreakdown | null) => void;
}

export function ReadingSessionContent({
  event,
  unit,
  onUsageChange,
}: ReadingSessionContentProps) {
  const addGenerated = useStudyStore((s) => s.addGenerated);
  const updateReadingAnswers = useStudyStore((s) => s.updateReadingAnswers);
  const generated = useStudyStore((s) => s.generated);
  const graded = useStudyStore((s) => s.graded);
  const addGraded = useStudyStore((s) => s.addGraded);
  const getGradedForEvent = useStudyStore((s) => s.getGradedForEvent);
  const markEventCompleted = useStudyStore((s) => s.markEventCompleted);
  const setSelectedEventId = useStudyStore((s) => s.setSelectedEventId);
  const geminiModel = useStudyStore((s) => s.geminiModel);
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const settings = useStudyStore((s) => s.settings);
  const preferredReadingClbBand = useStudyStore(
    (s) => s.preferredReadingClbBand,
  );
  const setPreferredReadingClbBand = useStudyStore(
    (s) => s.setPreferredReadingClbBand,
  );

  const sessionDurationMin = settings?.defaultSessionDurationMin ?? 45;

  const passageSets = useMemo(
    () => getGeneratedPassagesForEvent(generated, event.id),
    [generated, event.id],
  );

  const baseSet = useMemo(
    () => getBasePassageSet(passageSets),
    [passageSets],
  );

  const [activePassageNumber, setActivePassageNumber] = useState(1);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [passageStarted, setPassageStarted] = useState<Record<number, boolean>>(
    {},
  );
  const [answersByPassage, setAnswersByPassage] = useState<
    Record<number, Record<string, number>>
  >({});
  const [passageGradeResults, setPassageGradeResults] = useState<
    Record<number, GradeResponse>
  >({});
  const [loading, setLoading] = useState(passageSets.length === 0);
  const [generatingPassage, setGeneratingPassage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateUsage, setGenerateUsage] = useState<
    GeminiCostBreakdown | undefined
  >(baseSet?.geminiUsage);
  const [gradeUsage, setGradeUsage] = useState<GeminiCostBreakdown | undefined>();
  const [chatUsage, setChatUsage] = useState<GeminiCostBreakdown | undefined>();
  const [sessionFinished, setSessionFinished] = useState(
    event.status === "completed",
  );
  const [nextPassageClb, setNextPassageClb] = useState<number>(
    clampClb(preferredReadingClbBand),
  );
  const [questionTimings, setQuestionTimings] = useState<
    Record<number, Record<string, number>>
  >({});
  const generateInFlight = useRef(false);
  const activeQuestionRef = useRef<{
    passageNumber: number;
    questionIndex: number;
    enteredAt: number;
  } | null>(null);
  const passageStartedAtRef = useRef<Record<number, number>>({});

  useEffect(() => {
    setNextPassageClb((current) =>
      current === 0 ? clampClb(preferredReadingClbBand) : current,
    );
  }, [preferredReadingClbBand]);

  const sessionMode: SessionMode =
    unit.id === "w4rev-mon" || unit.practiceType === "Custom Generation"
      ? "review"
      : "subtest";

  const activePassageEventId = readingPassageEventId(
    event.id,
    activePassageNumber,
  );

  const activeSet = useMemo(
    () =>
      passageSets.find((s) => (s.setNumber ?? 1) === activePassageNumber) ??
      baseSet,
    [passageSets, activePassageNumber, baseSet],
  );

  const activeAnswers = answersByPassage[activePassageNumber] ?? {};
  const activeQuestions = useMemo(() => {
    if (!activeSet?.readingQuestions?.length) return [];
    return getReadingQuestionsForDisplay(activeSet, activeAnswers);
  }, [activeSet, activeAnswers]);

  const gradedPassageNumbers = useMemo(() => {
    const nums = new Set<number>();
    for (const set of passageSets) {
      const setNum = set.setNumber ?? 1;
      const passageId = readingPassageEventId(event.id, setNum);
      if (getGradedForEvent(passageId)) nums.add(setNum);
    }
    const legacy = getGradedForEvent(event.id);
    if (legacy) nums.add(1);
    return nums;
  }, [passageSets, event.id, getGradedForEvent, graded]);

  const hasAnyGradedPassage = gradedPassageNumbers.size > 0;

  useEffect(() => {
    onUsageChange(
      combineGeminiUsage(geminiModel, generateUsage, gradeUsage, chatUsage),
    );
  }, [generateUsage, gradeUsage, chatUsage, geminiModel, onUsageChange]);

  useEffect(() => {
    const hydrated: Record<number, Record<string, number>> = {};
    const grades: Record<number, GradeResponse> = {};
    const started: Record<number, boolean> = {};
    let anyProgress = event.status === "completed";

    for (const set of passageSets) {
      const setNum = set.setNumber ?? 1;
      const passageId = readingPassageEventId(event.id, setNum);
      const gradeSession = getGradedForEvent(passageId);

      if (
        gradeSession &&
        typeof gradeSession.studentSubmission === "object"
      ) {
        const answers = getReadingAnswers(gradeSession.studentSubmission);
        hydrated[setNum] = answers;
        const metadata = getReadingGradeMetadata(gradeSession.studentSubmission);
        const questions = getReadingQuestionsForDisplay(set, answers);
        const readingResults = buildReadingResults(
          answers,
          questions,
          metadata?.readingResults,
        );
        const score = getReadingPassageScore(answers, questions);
        const estimatedBand = Math.max(
          1,
          Math.min(
            12,
            Math.round(
              score.total > 0 ? (score.correct / score.total) * 12 : 0,
            ),
          ),
        );
        grades[setNum] = {
          estimatedBand,
          overallFeedback: gradeSession.overallFeedback,
          positives: gradeSession.positives,
          constructiveCriticism: gradeSession.constructiveCriticism,
          grammarCorrections: gradeSession.grammarCorrections,
          readingResults,
          skillTags: [],
        };
        started[setNum] = true;
        anyProgress = true;
      } else if (hasReadingPassageAnswers(set.readingAnswers)) {
        hydrated[setNum] = set.readingAnswers!;
        started[setNum] = true;
        anyProgress = true;
      }
    }

    setAnswersByPassage((prev) => ({ ...prev, ...hydrated }));
    setPassageGradeResults((prev) => ({ ...grades, ...prev }));

    if (anyProgress) {
      setSessionStarted(true);
      setPassageStarted((prev) => ({ ...prev, ...started }));
    }

    if (event.status === "completed") {
      setSessionFinished(true);
    }
  }, [passageSets, event.id, event.status, getGradedForEvent, graded]);

  const buildWeakStrong = useCallback(() => {
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
    return { weak, strong };
  }, [skillProfile]);

  const generatePassage = useCallback(
    async (setNumber: number) => {
      if (generateInFlight.current) return;
      generateInFlight.current = true;
      const isFirst = setNumber === 1;
      if (isFirst) setLoading(true);
      else setGeneratingPassage(true);
      setError(null);

      const { weak, strong } = buildWeakStrong();
      const passageEventId = readingPassageEventId(event.id, setNumber);

      const targetClbBand = clampClb(nextPassageClb);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            focusSubTest: unit.focusSubTest,
            focusTarget: unit.focusTarget,
            practiceType: unit.practiceType,
            sessionMode,
            readingPassageOnly: !isFirst,
            readingSetNumber: setNumber,
            weakConcepts: weak,
            strongConcepts: strong,
            targetClbBand,
            model: geminiModel,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to generate reading content");
        }

        const data = (await res.json()) as GenerateResponse;

        if (!data.readingQuestions?.length) {
          throw new Error("Generated passage has no questions. Please retry.");
        }

        addGenerated({
          eventId: passageEventId,
          instructions: isFirst ? data.instructions : "",
          example: isFirst ? data.example : "",
          examPrompt: data.examPrompt,
          readingQuestions: data.readingQuestions,
          readingAnswerIndexRepairVersion: READING_ANSWER_INDEX_REPAIR_VERSION,
          setNumber,
          generatedAt: new Date().toISOString(),
          geminiUsage: data.geminiUsage,
          passageCelpipPart: data.passageCelpipPart,
          passageTargetClbBand: data.passageTargetClbBand ?? targetClbBand,
        });

        if (isFirst && event.status !== "completed") {
          setSessionStarted(false);
        }

        if (isFirst) {
          setGenerateUsage(data.geminiUsage);
        } else {
          setGenerateUsage(
            combineGeminiUsage(geminiModel, generateUsage, data.geminiUsage) ??
              data.geminiUsage,
          );
        }

        setActivePassageNumber(setNumber);
        setAnswersByPassage((prev) => ({ ...prev, [setNumber]: {} }));
        setPassageStarted((prev) => ({ ...prev, [setNumber]: false }));
        delete passageStartedAtRef.current[setNumber];
      } catch (err) {
        setError(err instanceof Error ? err.message : "Generation failed");
      } finally {
        setLoading(false);
        setGeneratingPassage(false);
        generateInFlight.current = false;
      }
    },
    [
      addGenerated,
      buildWeakStrong,
      event.id,
      geminiModel,
      generateUsage,
      nextPassageClb,
      sessionMode,
      unit,
    ],
  );

  useEffect(() => {
    if (passageSets.length === 0) {
      void generatePassage(1);
    } else {
      setLoading(false);
    }
  }, [passageSets.length, generatePassage]);

  const commitActiveQuestionTiming = useCallback(() => {
    const active = activeQuestionRef.current;
    if (!active) return;
    const elapsed = (Date.now() - active.enteredAt) / 1000;
    if (elapsed < 0.5) return;
    setQuestionTimings((prev) => {
      const byPassage = prev[active.passageNumber] ?? {};
      const key = String(active.questionIndex);
      const prior = byPassage[key] ?? 0;
      return {
        ...prev,
        [active.passageNumber]: {
          ...byPassage,
          [key]: Math.round(prior + elapsed),
        },
      };
    });
  }, []);

  const handleQuestionFocus = useCallback(
    (questionIndex: number) => {
      const active = activeQuestionRef.current;
      if (
        active &&
        (active.passageNumber !== activePassageNumber ||
          active.questionIndex !== questionIndex)
      ) {
        commitActiveQuestionTiming();
      }
      activeQuestionRef.current = {
        passageNumber: activePassageNumber,
        questionIndex,
        enteredAt: Date.now(),
      };
    },
    [activePassageNumber, commitActiveQuestionTiming],
  );

  const persistPassageGrade = (
    setNumber: number,
    result: GradeResponse,
    answers: Record<string, number>,
  ) => {
    commitActiveQuestionTiming();
    activeQuestionRef.current = null;
    const passageEventId = readingPassageEventId(event.id, setNumber);
    const passageSet = passageSets.find(
      (set) => (set.setNumber ?? 1) === setNumber,
    );
    const questions = passageSet
      ? getReadingQuestionsForDisplay(passageSet, answers)
      : [];
    const passageStartedAt = passageStartedAtRef.current[setNumber];
    const passageDurationSeconds =
      passageStartedAt != null
        ? Math.max(0, Math.round((Date.now() - passageStartedAt) / 1000))
        : undefined;
    let timings = questionTimings[setNumber];
    if (
      passageDurationSeconds != null &&
      questions.length > 0 &&
      (!timings || Object.keys(timings).length === 0)
    ) {
      const perQuestion = Math.round(
        passageDurationSeconds / questions.length,
      );
      timings = Object.fromEntries(
        questions.map((_, index) => [String(index), perQuestion]),
      );
    }
    const submission = buildReadingSubmissionEnvelope(
      answers,
      questions,
      result,
      {
        questionTimings: timings,
        passageCelpipPart: passageSet?.passageCelpipPart,
        passageTargetClbBand: passageSet?.passageTargetClbBand,
        passageDurationSeconds,
      },
    );
    const enrichedResult: GradeResponse = {
      ...result,
      readingResults: submission.gradeMetadata?.readingResults,
    };
    setPassageGradeResults((prev) => ({ ...prev, [setNumber]: enrichedResult }));
    setGradeUsage(result.geminiUsage);
    addGraded(
      {
        eventId: passageEventId,
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
      },
      result,
      "subtest",
    );
  };

  const handleSubmitPassage = async () => {
    if (!activeSet) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focusSubTest: "Reading",
          examPrompt: activeSet.examPrompt,
          studentSubmission: activeAnswers,
          readingQuestions: activeQuestions,
          model: geminiModel,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Grading failed");
      }

      const result = (await res.json()) as GradeResponse;
      persistPassageGrade(activePassageNumber, result, activeAnswers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishSession = () => {
    if (hasAnyGradedPassage) {
      markEventCompleted(event.id);
      setSessionFinished(true);
    }
    setSelectedEventId(null);
  };

  const handleNewPassage = () => {
    const next = getNextPassageSetNumber(passageSets);
    void generatePassage(next);
  };

  const handleSelectPassage = (setNumber: number) => {
    setActivePassageNumber(setNumber);
  };

  const passageOptions = passageSets.map((set) => {
    const setNum = set.setNumber ?? 1;
    const passageId = readingPassageEventId(event.id, setNum);
    const gradeSession = getGradedForEvent(passageId);
    const answers =
      gradeSession && typeof gradeSession.studentSubmission === "object"
        ? getReadingAnswers(gradeSession.studentSubmission)
        : undefined;
    const questions = getReadingQuestionsForDisplay(set, answers);
    const score = getStoredReadingPassageScore(graded, passageId, questions);
    return {
      setNumber: setNum,
      label: formatPassageLabel(setNum, score),
      isActive: setNum === activePassageNumber,
      isGraded: gradedPassageNumbers.has(setNum),
    };
  });

  const currentPassageSubmitted = gradedPassageNumbers.has(activePassageNumber);
  const canAddPassage =
    currentPassageSubmitted && !sessionFinished && passageSets.length > 0;

  const activeGradeResult = passageGradeResults[activePassageNumber] ?? null;
  const reviewMode = sessionFinished || currentPassageSubmitted;
  const hasSavedProgress =
    hasAnyGradedPassage ||
    passageSets.some((set) => hasReadingPassageAnswers(set.readingAnswers));

  const lastSubmittedSetNumber = useMemo(() => {
    const submittedNums = passageSets
      .map((set) => set.setNumber ?? 1)
      .filter((num) => gradedPassageNumbers.has(num));
    return submittedNums.length > 0 ? Math.max(...submittedNums) : null;
  }, [passageSets, gradedPassageNumbers]);

  const lastPassageInfo = useMemo(() => {
    if (lastSubmittedSetNumber == null) return null;
    const set = passageSets.find(
      (s) => (s.setNumber ?? 1) === lastSubmittedSetNumber,
    );
    if (!set) return null;
    const passageId = readingPassageEventId(event.id, lastSubmittedSetNumber);
    const score = getStoredReadingPassageScore(
      graded,
      passageId,
      set.readingQuestions ?? [],
    );
    return {
      clb: set.passageTargetClbBand,
      score,
    };
  }, [lastSubmittedSetNumber, passageSets, event.id, graded]);

  const suggestedClbBand = useMemo(
    () => suggestNextClb(lastPassageInfo?.clb, lastPassageInfo?.score ?? null),
    [lastPassageInfo],
  );

  const handleNextPassageClbChange = (band: number) => {
    const clamped = clampClb(band);
    setNextPassageClb(clamped);
    setPreferredReadingClbBand(clamped);
  };

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error && !baseSet) {
    return (
      <div className="space-y-4 py-4 text-center">
        <p className="text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => void generatePassage(1)}
          className="text-sm text-blue-600 hover:underline"
        >
          Retry generation
        </button>
      </div>
    );
  }

  if (!baseSet || !activeSet) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReadingPractice
        instructions={baseSet.instructions}
        example={baseSet.example}
        sessionGoal={unit.sessionGoal}
        grammarFocus={unit.grammarFocus}
        strategy={unit.strategy}
        focusTarget={unit.focusTarget}
        practiceType={unit.practiceType}
        sessionDurationMin={sessionDurationMin}
        passages={passageOptions}
        activePassageNumber={activePassageNumber}
        onSelectPassage={handleSelectPassage}
        onNewPassage={handleNewPassage}
        generatingPassage={generatingPassage}
        canAddPassage={canAddPassage}
        examPrompt={activeSet.examPrompt}
        questions={activeQuestions}
        sessionStarted={sessionStarted}
        onStartSession={() => setSessionStarted(true)}
        passageStarted={Boolean(passageStarted[activePassageNumber])}
        onStartPassage={() => {
          passageStartedAtRef.current[activePassageNumber] ??= Date.now();
          setPassageStarted((prev) => ({
            ...prev,
            [activePassageNumber]: true,
          }));
        }}
        answers={activeAnswers}
        onAnswersChange={(answers) => {
          setAnswersByPassage((prev) => ({
            ...prev,
            [activePassageNumber]: answers,
          }));
          if (!currentPassageSubmitted) {
            updateReadingAnswers(activePassageEventId, answers);
          }
        }}
        onSubmit={() => void handleSubmitPassage()}
        submitting={submitting}
        readOnly={reviewMode}
        sessionFinished={sessionFinished}
        currentPassageSubmitted={currentPassageSubmitted}
        gradeResult={activeGradeResult}
        defaultTab={hasSavedProgress ? "passage" : "instructions"}
        nextPassageClbBand={nextPassageClb}
        onNextPassageClbBandChange={handleNextPassageClbChange}
        suggestedClbBand={suggestedClbBand}
        activePassageClbBand={activeSet.passageTargetClbBand}
        onQuestionFocus={handleQuestionFocus}
        passageEventId={activePassageEventId}
        onReadingChatUsage={(usage) =>
          setChatUsage((prev) =>
            combineGeminiUsage(geminiModel, prev, usage) ?? usage,
          )
        }
      />
      {hasAnyGradedPassage && !sessionFinished && (
        <div className="mt-3 shrink-0">
          <Button type="button" variant="outline" onClick={handleFinishSession}>
            Finish session
          </Button>
        </div>
      )}
      {sessionFinished && (
        <div className="mt-3 shrink-0">
          <Button type="button" variant="outline" onClick={() => setSelectedEventId(null)}>
            Close
          </Button>
        </div>
      )}
      {error && <p className="mt-3 shrink-0 text-sm text-red-600">{error}</p>}
    </div>
  );
}
