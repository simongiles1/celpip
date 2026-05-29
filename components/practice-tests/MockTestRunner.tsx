"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  ExamCountdownDisplay,
  useExamCountdown,
} from "@/components/session/ExamCountdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { useStudyStore } from "@/hooks/useStudyStore";
import {
  formatMockDuration,
  newMockEventId,
  READING_PART_LABEL,
  type MockSpec,
} from "@/lib/celpip-mocks";
import { buildReadingSubmissionEnvelope } from "@/lib/reading-submission";
import { getReadingQuestionsForGrading } from "@/lib/repair-reading-answer-indices";
import type {
  CelpipReadingPart,
  GenerateResponse,
  GradeResponse,
  ReadingQuestion,
} from "@/lib/types";
import { countWords } from "@/lib/utils";

interface SegmentState {
  index: number;
  status:
    | "pending"
    | "generating"
    | "ready"
    | "started"
    | "submitting"
    | "graded"
    | "error";
  examPrompt?: string;
  readingQuestions?: ReadingQuestion[];
  answers: Record<string, number>;
  writingText: string;
  startedAt?: number;
  submittedAt?: number;
  gradeResult?: GradeResponse;
  error?: string;
  passageCelpipPart?: CelpipReadingPart;
  passageTargetClbBand?: number;
}

interface MockSegmentDescriptor {
  kind: "reading_part" | "writing_task";
  celpipPart?: CelpipReadingPart;
  task?: "task_1" | "task_2";
  questionCount?: number;
  timeLimitSec: number;
  label: string;
}

function describeSegments(spec: MockSpec): MockSegmentDescriptor[] {
  if (spec.readingSegments) {
    return spec.readingSegments.map((seg) => ({
      kind: "reading_part" as const,
      celpipPart: seg.celpipPart,
      questionCount: seg.questionCount,
      timeLimitSec: seg.timeLimitSec,
      label: READING_PART_LABEL[seg.celpipPart],
    }));
  }
  return (spec.writingSegments ?? []).map((seg) => ({
    kind: "writing_task" as const,
    task: seg.task,
    timeLimitSec: seg.timeLimitSec,
    label:
      seg.task === "task_1"
        ? "Task 1 — Email (27 min)"
        : "Task 2 — Survey Opinion (26 min)",
  }));
}

function segmentEventId(attemptId: string, index: number): string {
  return `${attemptId}-seg-${index}`;
}

export function MockTestRunner({ spec }: { spec: MockSpec }) {
  const router = useRouter();
  const geminiModel = useStudyStore((s) => s.geminiModel);
  const preferredReadingClbBand = useStudyStore(
    (s) => s.preferredReadingClbBand,
  );
  const addGraded = useStudyStore((s) => s.addGraded);

  const segments = useMemo(() => describeSegments(spec), [spec]);
  const attemptIdRef = useRef<string>(newMockEventId(spec.id));

  const [activeIndex, setActiveIndex] = useState(0);
  const [segmentStates, setSegmentStates] = useState<SegmentState[]>(() =>
    segments.map((_, i) => ({
      index: i,
      status: "pending",
      answers: {},
      writingText: "",
    })),
  );

  const activeSegment = segments[activeIndex];
  const activeState = segmentStates[activeIndex];

  // Per-question timing — only meaningful for reading.
  const [questionTimings, setQuestionTimings] = useState<
    Record<number, Record<string, number>>
  >({});
  const activeQuestionRef = useRef<{
    segIndex: number;
    qIndex: number;
    enteredAt: number;
  } | null>(null);

  const generateInFlight = useRef<Set<number>>(new Set());

  const updateSegment = useCallback(
    (index: number, patch: Partial<SegmentState>) => {
      setSegmentStates((prev) =>
        prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  const generateSegment = useCallback(
    async (index: number) => {
      if (generateInFlight.current.has(index)) return;
      generateInFlight.current.add(index);
      const seg = segments[index];
      updateSegment(index, { status: "generating", error: undefined });

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            focusSubTest: spec.subTest,
            focusTarget: "CELPIP mock",
            practiceType: spec.label,
            sessionMode: "subtest",
            mockTarget:
              seg.kind === "reading_part"
                ? {
                    kind: "reading_part",
                    celpipPart: seg.celpipPart,
                    questionCount: seg.questionCount ?? 8,
                  }
                : { kind: "writing_task", task: seg.task! },
            targetClbBand: Math.max(9, preferredReadingClbBand),
            model: geminiModel,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to generate mock content");
        }

        const data = (await res.json()) as GenerateResponse;

        updateSegment(index, {
          status: "ready",
          examPrompt: data.examPrompt,
          readingQuestions: data.readingQuestions,
          passageCelpipPart: data.passageCelpipPart,
          passageTargetClbBand: data.passageTargetClbBand,
        });
      } catch (err) {
        updateSegment(index, {
          status: "error",
          error: err instanceof Error ? err.message : "Generation failed",
        });
      } finally {
        generateInFlight.current.delete(index);
      }
    },
    [segments, spec, geminiModel, preferredReadingClbBand, updateSegment],
  );

  // Auto-generate the active segment when it becomes the active one.
  useEffect(() => {
    if (!activeSegment || !activeState) return;
    if (activeState.status === "pending") {
      void generateSegment(activeIndex);
    }
  }, [activeIndex, activeSegment, activeState, generateSegment]);

  const startSegment = () => {
    updateSegment(activeIndex, { status: "started", startedAt: Date.now() });
  };

  const commitActiveQuestionTiming = useCallback(() => {
    const active = activeQuestionRef.current;
    if (!active) return;
    const elapsed = (Date.now() - active.enteredAt) / 1000;
    if (elapsed < 0.5) return;
    setQuestionTimings((prev) => {
      const bySeg = prev[active.segIndex] ?? {};
      const key = String(active.qIndex);
      const prior = bySeg[key] ?? 0;
      return {
        ...prev,
        [active.segIndex]: {
          ...bySeg,
          [key]: Math.round(prior + elapsed),
        },
      };
    });
  }, []);

  const handleQuestionFocus = useCallback(
    (qIndex: number) => {
      const active = activeQuestionRef.current;
      if (active && (active.segIndex !== activeIndex || active.qIndex !== qIndex)) {
        commitActiveQuestionTiming();
      }
      activeQuestionRef.current = {
        segIndex: activeIndex,
        qIndex,
        enteredAt: Date.now(),
      };
    },
    [activeIndex, commitActiveQuestionTiming],
  );

  const submitSegment = useCallback(
    async (index: number, autoSubmitted: boolean) => {
      const seg = segments[index];
      const state = segmentStates[index];
      if (!state || state.status === "submitting" || state.status === "graded") {
        return;
      }
      if (state.status !== "started") {
        // The segment was never started — record an empty submission so analytics keeps order.
      }

      commitActiveQuestionTiming();
      activeQuestionRef.current = null;
      updateSegment(index, { status: "submitting" });

      try {
        const eventId = segmentEventId(attemptIdRef.current, index);

        if (seg.kind === "reading_part") {
          const rawQuestions = state.readingQuestions ?? [];
          const answers = state.answers;
          const questions = getReadingQuestionsForGrading(rawQuestions, {
            examPrompt: state.examPrompt,
            studentAnswers: answers,
          });

          const res = await fetch("/api/grade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              focusSubTest: "Reading",
              examPrompt: state.examPrompt ?? "",
              studentSubmission: answers,
              readingQuestions: questions,
              model: geminiModel,
            }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? "Grading failed");
          }

          const grade = (await res.json()) as GradeResponse;
          const timings = questionTimings[index];
          const submission = buildReadingSubmissionEnvelope(
            answers,
            questions,
            grade,
            {
              questionTimings: timings,
              passageCelpipPart: state.passageCelpipPart ?? seg.celpipPart,
              passageTargetClbBand: state.passageTargetClbBand,
              passageDurationSeconds:
                state.startedAt != null
                  ? Math.round((Date.now() - state.startedAt) / 1000)
                  : undefined,
            },
          );
          submission.readingQuestions = questions;
          submission.examPrompt = state.examPrompt;

          addGraded(
            {
              eventId,
              curriculumUnitId: spec.id,
              focusSubTest: "Reading",
              estimatedBand: grade.estimatedBand,
              overallFeedback: grade.overallFeedback,
              positives: grade.positives,
              constructiveCriticism: grade.constructiveCriticism,
              grammarCorrections: grade.grammarCorrections,
              studentSubmission: submission,
              gradedAt: new Date().toISOString(),
              geminiUsage: grade.geminiUsage,
              isMock: true,
              mockSpecId: spec.id,
            },
            grade,
            "subtest",
          );

          updateSegment(index, {
            status: "graded",
            gradeResult: {
              ...grade,
              readingResults: submission.gradeMetadata?.readingResults,
            },
            submittedAt: Date.now(),
          });
        } else {
          const writingText = state.writingText.trim();
          if (!writingText && !autoSubmitted) {
            updateSegment(index, {
              status: "started",
              error: "Write at least a few sentences before submitting.",
            });
            return;
          }

          const res = await fetch("/api/grade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              focusSubTest: "Writing",
              examPrompt: state.examPrompt ?? "",
              studentSubmission: writingText || "(no response submitted)",
              model: geminiModel,
            }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? "Grading failed");
          }

          const grade = (await res.json()) as GradeResponse;
          addGraded(
            {
              eventId,
              curriculumUnitId: spec.id,
              focusSubTest: "Writing",
              estimatedBand: grade.estimatedBand,
              overallFeedback: grade.overallFeedback,
              positives: grade.positives,
              constructiveCriticism: grade.constructiveCriticism,
              grammarCorrections: grade.grammarCorrections,
              studentSubmission: writingText || "(no response submitted)",
              gradedAt: new Date().toISOString(),
              geminiUsage: grade.geminiUsage,
              isMock: true,
              mockSpecId: spec.id,
            },
            grade,
            "subtest",
          );

          updateSegment(index, {
            status: "graded",
            gradeResult: grade,
            submittedAt: Date.now(),
          });
        }

        if (index < segments.length - 1) {
          setActiveIndex(index + 1);
        }
      } catch (err) {
        updateSegment(index, {
          status: "error",
          error: err instanceof Error ? err.message : "Submission failed",
        });
      }
    },
    [
      segments,
      segmentStates,
      commitActiveQuestionTiming,
      updateSegment,
      geminiModel,
      questionTimings,
      addGraded,
      spec,
    ],
  );

  // Segment timer + auto-submit on expiry.
  const isSegmentStarted = activeState?.status === "started";
  const segmentTimer = useExamCountdown(
    activeSegment?.timeLimitSec ?? 0,
    isSegmentStarted,
  );
  const segmentTimerExpired = segmentTimer.expired;

  useEffect(() => {
    if (
      segmentTimerExpired &&
      activeState?.status === "started" &&
      activeSegment
    ) {
      void submitSegment(activeIndex, true);
    }
  }, [segmentTimerExpired, activeIndex, activeSegment, activeState, submitSegment]);

  const allGraded = segmentStates.every((s) => s.status === "graded");

  const totalBand = useMemo(() => {
    const graded = segmentStates.filter((s) => s.gradeResult);
    if (graded.length === 0) return null;
    return (
      graded.reduce((sum, s) => sum + (s.gradeResult?.estimatedBand ?? 0), 0) /
      graded.length
    );
  }, [segmentStates]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Badge variant="outline">{spec.subTest}</Badge>
          <h1 className="text-xl font-bold text-gray-900">{spec.label}</h1>
          <p className="text-sm text-gray-600">{spec.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="secondary">
            {formatMockDuration(spec.totalTimeSec)} total
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/practice-tests")}
          >
            Exit mock
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
        {segments.map((seg, i) => {
          const s = segmentStates[i];
          const isActive = i === activeIndex;
          const variant = isActive
            ? "default"
            : s.status === "graded"
              ? "outline"
              : "outline";
          return (
            <button
              key={`${seg.kind}-${i}`}
              type="button"
              onClick={() => {
                commitActiveQuestionTiming();
                activeQuestionRef.current = null;
                setActiveIndex(i);
              }}
              className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-blue-600 bg-blue-600 text-white"
                  : s.status === "graded"
                    ? "border-green-300 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {i + 1}. {seg.label}
              {s.status === "graded" && s.gradeResult && (
                <span className="ml-2 opacity-80">
                  · CLB {s.gradeResult.estimatedBand}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeSegment && activeState && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">{activeSegment.label}</CardTitle>
              {isSegmentStarted && (
                <ExamCountdownDisplay
                  remaining={segmentTimer.remaining}
                  expired={segmentTimer.expired}
                  label="Strict timer"
                  className="min-w-[180px]"
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {activeState.status === "generating" && (
              <p className="text-sm text-gray-500">Generating mock content...</p>
            )}
            {activeState.status === "error" && (
              <div className="space-y-2">
                <p className="text-sm text-red-600">{activeState.error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void generateSegment(activeIndex)}
                >
                  Retry generation
                </Button>
              </div>
            )}
            {activeState.status === "ready" && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center">
                <p className="text-sm text-gray-700">
                  Ready to start{" "}
                  <span className="font-medium">{activeSegment.label}</span>?
                  Once you click Start, the timer cannot be paused. The segment
                  auto-submits when time expires.
                </p>
                <Button type="button" size="lg" onClick={startSegment}>
                  Start {activeSegment.label}
                </Button>
              </div>
            )}
            {(activeState.status === "started" ||
              activeState.status === "submitting") && (
              <SegmentBody
                segment={activeSegment}
                state={activeState}
                onAnswerChange={(qIndex, optionIndex) =>
                  updateSegment(activeIndex, {
                    answers: {
                      ...activeState.answers,
                      [String(qIndex)]: optionIndex,
                    },
                  })
                }
                onWritingChange={(value) =>
                  updateSegment(activeIndex, { writingText: value })
                }
                onQuestionFocus={handleQuestionFocus}
                onSubmit={() => void submitSegment(activeIndex, false)}
                submitting={activeState.status === "submitting"}
                expired={segmentTimer.expired}
              />
            )}
            {activeState.status === "graded" && activeState.gradeResult && (
              <SegmentGradedView
                segment={activeSegment}
                state={activeState}
                grade={activeState.gradeResult}
              />
            )}
          </CardContent>
        </Card>
      )}

      {allGraded && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mock complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="success">
                Avg CLB {Math.round(totalBand ?? 0)}
              </Badge>
              <span className="text-sm text-gray-600">
                {segments.length} segment{segments.length !== 1 ? "s" : ""}{" "}
                graded.
              </span>
            </div>
            <p className="text-sm text-gray-600">
              All segments saved as mock attempts. View the per-Part, per-question-type,
              pacing, and stamina breakdowns on the Analytics page.
            </p>
            <div className="flex gap-2">
              <Button type="button" onClick={() => router.push("/analytics")}>
                Open Analytics
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/practice-tests")}
              >
                Back to Practice Tests
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SegmentBody({
  segment,
  state,
  onAnswerChange,
  onWritingChange,
  onQuestionFocus,
  onSubmit,
  submitting,
  expired,
}: {
  segment: MockSegmentDescriptor;
  state: SegmentState;
  onAnswerChange: (qIndex: number, optionIndex: number) => void;
  onWritingChange: (value: string) => void;
  onQuestionFocus: (qIndex: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  expired: boolean;
}) {
  if (segment.kind === "writing_task") {
    const TARGET_MIN = 150;
    const TARGET_MAX = 200;
    const words = countWords(state.writingText);
    const inRange = words >= TARGET_MIN && words <= TARGET_MAX;
    return (
      <div className="flex flex-col gap-4">
        <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 px-4 py-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Prompt</h3>
          <div className="prose prose-sm max-w-none [&>:first-child]:mt-0">
            <ReactMarkdown>{state.examPrompt ?? ""}</ReactMarkdown>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Your Response
            </label>
            <span
              className={`text-xs font-medium ${
                inRange ? "text-green-600" : "text-amber-600"
              }`}
            >
              {words} words (target: {TARGET_MIN}-{TARGET_MAX})
            </span>
          </div>
          <Textarea
            value={state.writingText}
            onChange={(e) => onWritingChange(e.target.value)}
            placeholder="Write your response here..."
            disabled={submitting || expired}
            rows={14}
            className="min-h-[280px]"
          />
        </div>
        {expired && (
          <p className="text-xs text-red-600">
            Time is up. The segment will auto-submit. You can also submit now.
          </p>
        )}
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitting || (words < 20 && !expired)}
          className="self-start"
        >
          {submitting ? "Grading..." : "Submit task"}
        </Button>
      </div>
    );
  }

  const questions = useMemo(
    () =>
      getReadingQuestionsForGrading(state.readingQuestions ?? [], {
        examPrompt: state.examPrompt,
        studentAnswers: state.answers,
      }),
    [state.readingQuestions, state.examPrompt, state.answers],
  );
  const allAnswered =
    questions.length > 0 &&
    questions.every((_, i) => state.answers[String(i)] !== undefined);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex max-h-[60vh] flex-col overflow-hidden rounded-lg border border-gray-200">
          <h3 className="shrink-0 border-b border-gray-200 px-4 py-2 text-sm font-semibold text-gray-900">
            Passage
          </h3>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="prose prose-sm max-w-none [&>:first-child]:mt-0">
              <ReactMarkdown>{state.examPrompt ?? ""}</ReactMarkdown>
            </div>
          </div>
        </div>
        <div className="flex max-h-[60vh] flex-col overflow-hidden rounded-lg border border-gray-200">
          <h3 className="shrink-0 border-b border-gray-200 px-4 py-2 text-sm font-semibold text-gray-900">
            Questions ({questions.length})
          </h3>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-3">
            {questions.map((q, qIndex) => {
              const selectedIndex = state.answers[String(qIndex)];
              return (
                <fieldset
                  key={q.question}
                  className="space-y-2"
                  onFocusCapture={() => onQuestionFocus(qIndex)}
                  onPointerDownCapture={() => onQuestionFocus(qIndex)}
                >
                  <legend className="text-sm font-medium text-gray-900">
                    {qIndex + 1}. {q.question}
                  </legend>
                  {q.options.map((option, oIndex) => {
                    const selected = selectedIndex === oIndex;
                    return (
                      <label
                        key={option}
                        className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${
                          selected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:bg-gray-50"
                        } ${submitting || expired ? "pointer-events-none opacity-60" : ""}`}
                      >
                        <input
                          type="radio"
                          name={`seg-q-${qIndex}`}
                          checked={selected ?? false}
                          onChange={() => onAnswerChange(qIndex, oIndex)}
                          disabled={submitting || expired}
                          className="mt-0.5"
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </fieldset>
              );
            })}
          </div>
        </div>
      </div>
      {expired && (
        <p className="text-xs text-red-600">
          Time is up. The segment will auto-submit. You can also submit now.
        </p>
      )}
      <Button
        type="button"
        onClick={onSubmit}
        disabled={submitting || (!allAnswered && !expired)}
        className="self-start"
      >
        {submitting ? "Grading..." : "Submit part"}
      </Button>
    </div>
  );
}

function SegmentGradedView({
  segment,
  state,
  grade,
}: {
  segment: MockSegmentDescriptor;
  state: SegmentState;
  grade: GradeResponse;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="success">CLB {grade.estimatedBand}</Badge>
        {segment.kind === "reading_part" && grade.readingResults && (
          <Badge variant="outline">
            {grade.readingResults.filter((r) => r.isCorrect).length}/
            {grade.readingResults.length} correct
          </Badge>
        )}
      </div>
      {grade.overallFeedback.trim() && (
        <div className="rounded-lg border border-gray-200 px-3 py-2">
          <h4 className="text-xs font-semibold text-gray-700">
            Overall feedback
          </h4>
          <div className="prose prose-sm mt-1 max-w-none [&>:first-child]:mt-0">
            <ReactMarkdown>{grade.overallFeedback}</ReactMarkdown>
          </div>
        </div>
      )}
      {segment.kind === "reading_part" && grade.readingResults && (
        <details className="rounded-lg border border-gray-200 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-gray-700">
            Per-question results
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {grade.readingResults.map((r) => (
              <li key={r.index} className="flex gap-2">
                <span className="font-medium">
                  Q{r.index + 1} {r.isCorrect ? "✓" : "✗"}
                </span>
                <span className="text-gray-600">{r.feedback}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {state.writingText && segment.kind === "writing_task" && (
        <details className="rounded-lg border border-gray-200 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-gray-700">
            Your response
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-xs text-gray-700">
            {state.writingText}
          </p>
        </details>
      )}
    </div>
  );
}
