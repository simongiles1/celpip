"use client";

import { useEffect, useRef } from "react";
import {
  ExamCountdownDualDisplay,
  useExamCountdown,
} from "@/components/session/ExamCountdown";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/ui/markdown";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getReadingPassageTimeLimitSeconds,
  getSessionTimeLimitLabel,
  getSessionTimeLimitSeconds,
  getThemedReadingPassagePaceLabel,
} from "@/lib/exam-timing";
import { getThemedReadingStartCopy } from "@/lib/exercise-types";
import { getReadingPassageScore } from "@/lib/reading-passage-sets";
import type { GradeResponse, ReadingQuestion } from "@/lib/types";

export interface ReadingPassageOption {
  setNumber: number;
  label: string;
  isActive: boolean;
  isGraded: boolean;
}

interface ReadingPracticeProps {
  instructions: string;
  example: string;
  sessionGoal: string;
  grammarFocus?: string;
  strategy?: string;
  focusTarget: string;
  practiceType: string;
  sessionDurationMin: number;
  passages: ReadingPassageOption[];
  activePassageNumber: number;
  onSelectPassage: (setNumber: number) => void;
  onNewPassage: () => void;
  generatingPassage?: boolean;
  canAddPassage: boolean;
  examPrompt: string;
  questions: ReadingQuestion[];
  sessionStarted: boolean;
  onStartSession: () => void;
  passageStarted: boolean;
  onStartPassage: () => void;
  answers: Record<string, number>;
  onAnswersChange: (answers: Record<string, number>) => void;
  onSubmit: () => void;
  submitting: boolean;
  readOnly?: boolean;
  sessionFinished?: boolean;
  currentPassageSubmitted?: boolean;
  gradeResult?: GradeResponse | null;
  defaultTab?: "instructions" | "focus" | "passage";
  onSessionExpired?: () => void;
  /** CLB difficulty controls for the next-passage generator. */
  nextPassageClbBand?: number;
  onNextPassageClbBandChange?: (band: number) => void;
  /** Suggested band based on last passage accuracy. Displayed as a hint. */
  suggestedClbBand?: number | null;
  /** Active passage CLB band (if generated AI declared one). */
  activePassageClbBand?: number;
  /** Per-question time tracking (seconds). */
  onQuestionFocus?: (questionIndex: number) => void;
}

const tabPanelClass = "mt-3 flex min-h-0 flex-1 flex-col overflow-hidden";
const scrollPanelClass =
  "min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 px-4 py-3";

function clampClb(value: number): number {
  if (!Number.isFinite(value)) return 9;
  return Math.max(6, Math.min(12, Math.round(value)));
}

function ClbBandSlider({
  value,
  onChange,
  suggested,
  disabled,
  variant = "card",
}: {
  value: number;
  onChange: (band: number) => void;
  suggested: number | null;
  disabled?: boolean;
  variant?: "card" | "inline";
}) {
  const clamped = clampClb(value);
  const showSuggest =
    suggested != null && suggested >= 6 && suggested <= 12 && suggested !== clamped;
  const inline = variant === "inline";

  return (
    <div
      className={
        inline
          ? "flex shrink-0 flex-wrap items-center gap-2"
          : "flex shrink-0 flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
      }
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-700">
          Next passage difficulty
        </span>
        <Badge variant="outline" className="text-xs">
          CLB {clamped}
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(clampClb(clamped - 1))}
          disabled={disabled || clamped <= 6}
          aria-label="Lower difficulty"
        >
          −
        </Button>
        <input
          type="range"
          min={6}
          max={12}
          step={1}
          value={clamped}
          onChange={(e) => onChange(clampClb(Number(e.target.value)))}
          disabled={disabled}
          aria-label="CLB difficulty band (6 to 12)"
          className="h-2 w-32 cursor-pointer accent-blue-600"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(clampClb(clamped + 1))}
          disabled={disabled || clamped >= 12}
          aria-label="Increase difficulty"
        >
          +
        </Button>
      </div>
      {showSuggest && (
        <button
          type="button"
          onClick={() => onChange(clampClb(suggested))}
          className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
          disabled={disabled}
          title="Auto-suggested based on your last passage accuracy"
        >
          Try CLB {suggested}
        </button>
      )}
    </div>
  );
}

function QuestionResultBadge({ isCorrect }: { isCorrect: boolean }) {
  return (
    <Badge variant={isCorrect ? "success" : "warning"}>
      {isCorrect ? "Correct" : "Incorrect"}
    </Badge>
  );
}

function GradedQuestionFeedback({
  result,
}: {
  result: NonNullable<GradeResponse["readingResults"]>[number];
}) {
  return (
    <span className="ml-2 inline-flex shrink-0">
      <QuestionResultBadge isCorrect={result.isCorrect} />
    </span>
  );
}

function GradedQuestionExplanation({
  result,
}: {
  result: NonNullable<GradeResponse["readingResults"]>[number];
}) {
  if (result.isCorrect) {
    if (!result.feedback.trim() || result.feedback === "Correct.") return null;
    return (
      <p className="mt-2 text-xs text-gray-600">{result.feedback}</p>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-gray-700">
      <p className="font-medium text-green-700">
        Correct answer: {result.correctAnswer}
      </p>
      {result.feedback.trim() && (
        <p className="mt-1">{result.feedback}</p>
      )}
    </div>
  );
}

function getOptionClassName({
  selected,
  isCorrectOption,
  isGraded,
  inputLocked,
}: {
  selected: boolean;
  isCorrectOption: boolean;
  isGraded: boolean;
  inputLocked: boolean;
}): string {
  const base =
    "flex w-full min-w-0 items-start gap-2 rounded-md border p-2 text-sm";

  if (isGraded) {
    if (selected && isCorrectOption) {
      return `${base} border-green-500 bg-green-50`;
    }
    if (selected && !isCorrectOption) {
      return `${base} border-red-500 bg-red-50`;
    }
    if (isCorrectOption) {
      return `${base} border-green-300 bg-green-50/70`;
    }
    return `${base} border-gray-200`;
  }

  let optionClass = `${base} cursor-pointer border-gray-200 hover:bg-gray-50`;

  if (selected) {
    optionClass = `${base} cursor-pointer border-blue-500 bg-blue-50`;
  }

  if (inputLocked) {
    optionClass += " pointer-events-none opacity-60";
  }

  return optionClass;
}

export function ReadingPractice({
  instructions,
  example,
  sessionGoal,
  grammarFocus,
  strategy,
  focusTarget,
  practiceType,
  sessionDurationMin,
  passages,
  activePassageNumber,
  onSelectPassage,
  onNewPassage,
  generatingPassage = false,
  canAddPassage,
  examPrompt,
  questions,
  sessionStarted,
  onStartSession,
  passageStarted,
  onStartPassage,
  answers,
  onAnswersChange,
  onSubmit,
  submitting,
  readOnly = false,
  sessionFinished = false,
  currentPassageSubmitted = false,
  gradeResult = null,
  defaultTab = "instructions",
  onSessionExpired,
  nextPassageClbBand,
  onNextPassageClbBandChange,
  suggestedClbBand,
  activePassageClbBand,
  onQuestionFocus,
}: ReadingPracticeProps) {
  const sessionLimitSeconds = getSessionTimeLimitSeconds(sessionDurationMin);
  const passageLimitSeconds = getReadingPassageTimeLimitSeconds(practiceType);
  const sessionLimitLabel = getSessionTimeLimitLabel(sessionDurationMin);
  const passagePaceLabel = getThemedReadingPassagePaceLabel(practiceType);
  const sessionStartCopy = getThemedReadingStartCopy({
    focusTarget,
    sessionLimitLabel,
    suggestedPassageLabel: passagePaceLabel,
  });

  const {
    remaining: sessionRemaining,
    expired: sessionExpired,
  } = useExamCountdown(sessionLimitSeconds, sessionStarted);

  const {
    remaining: passageRemaining,
    expired: passageExpired,
  } = useExamCountdown(passageLimitSeconds, passageStarted);

  const sessionExpiredNotified = useRef(false);
  useEffect(() => {
    if (sessionExpired && !sessionExpiredNotified.current) {
      sessionExpiredNotified.current = true;
      onSessionExpired?.();
    }
    if (!sessionExpired) {
      sessionExpiredNotified.current = false;
    }
  }, [sessionExpired, onSessionExpired]);

  const allAnswered =
    questions.length > 0 &&
    questions.every((_, i) => answers[String(i)] !== undefined);

  const inputLocked = readOnly || passageExpired || sessionExpired;
  const readingResultsByIndex = new Map(
    gradeResult?.readingResults?.map((result) => [result.index, result]) ?? [],
  );
  const isGraded =
    currentPassageSubmitted &&
    Boolean(gradeResult?.readingResults?.length) &&
    passageStarted;
  const passageScore = isGraded
    ? getReadingPassageScore(answers, questions)
    : null;

  return (
    <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col">
      <TabsList className="grid h-auto w-full shrink-0 grid-cols-3 gap-1">
        <TabsTrigger value="instructions" className="text-xs sm:text-sm">
          Instructions
        </TabsTrigger>
        <TabsTrigger value="focus" className="text-xs sm:text-sm">
          Session Focus
        </TabsTrigger>
        <TabsTrigger value="passage" className="text-xs sm:text-sm">
          Passage / Questions
        </TabsTrigger>
      </TabsList>

      <TabsContent value="instructions" className={tabPanelClass}>
        <div className={scrollPanelClass}>
          <MarkdownContent className="prose prose-sm max-w-none [&>:first-child]:mt-0">
            {instructions}
          </MarkdownContent>
          {example.trim() && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Strategy walkthrough
              </h3>
              <MarkdownContent className="prose prose-sm mt-2 max-w-none [&>:first-child]:mt-0">
                {example}
              </MarkdownContent>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="focus" className={tabPanelClass}>
        <div className={scrollPanelClass}>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Goal</h3>
              <p className="mt-1 text-sm text-gray-600">{sessionGoal}</p>
            </div>
            {grammarFocus && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Grammar Focus
                </h3>
                <p className="mt-1 text-sm text-gray-600">{grammarFocus}</p>
              </div>
            )}
            {strategy && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Strategy</h3>
                <p className="mt-1 text-sm text-gray-600">{strategy}</p>
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="passage" className={tabPanelClass}>
        {!sessionStarted ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-gray-900">
                {sessionStartCopy.title}
              </h3>
              <p className="max-w-sm text-sm text-gray-600">
                {sessionStartCopy.body}
              </p>
            </div>
            <Button type="button" size="lg" onClick={onStartSession}>
              Start session
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {!isGraded && (
                <ExamCountdownDualDisplay
                  layout="inline"
                  sessionRemaining={sessionRemaining}
                  sessionExpired={sessionExpired}
                  passageRemaining={passageRemaining}
                  passageExpired={passageExpired}
                  showPassage={passageStarted}
                />
              )}
              {passages.map((passage) => (
                  <Button
                    key={passage.setNumber}
                    type="button"
                    size="sm"
                    variant={passage.isActive ? "default" : "outline"}
                    onClick={() => onSelectPassage(passage.setNumber)}
                    disabled={sessionFinished && !passage.isGraded}
                  >
                    {passage.label}
                  </Button>
                ))}
                {activePassageClbBand != null && (
                  <Badge variant="outline" className="text-xs">
                    CLB {activePassageClbBand}
                  </Badge>
                )}
                {canAddPassage && !currentPassageSubmitted && (
                  <span className="text-xs text-gray-500">
                    Submit this passage to unlock another
                  </span>
                )}
                {canAddPassage && currentPassageSubmitted && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onNewPassage}
                    disabled={
                      sessionFinished || generatingPassage || sessionExpired
                    }
                  >
                    {generatingPassage ? "Generating..." : "New passage"}
                  </Button>
                )}
                {nextPassageClbBand != null &&
                  onNextPassageClbBandChange &&
                  !sessionFinished && (
                    <ClbBandSlider
                      variant="inline"
                      value={nextPassageClbBand}
                      onChange={onNextPassageClbBandChange}
                      suggested={suggestedClbBand ?? null}
                      disabled={generatingPassage}
                    />
                  )}
            </div>

            {sessionExpired && !isGraded && (
              <p className="shrink-0 text-xs text-red-600">
                Session time is up. Finish the session to save your progress.
              </p>
            )}

            {!passageStarted ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-gray-900">
                    Ready for passage {activePassageNumber}?
                  </h3>
                  <p className="max-w-sm text-sm text-gray-600">
                    Suggested pace: about {passagePaceLabel} (you may finish
                    sooner). The passage stays hidden until you start.
                  </p>
                </div>
                <Button
                  type="button"
                  size="lg"
                  onClick={onStartPassage}
                  disabled={sessionFinished || sessionExpired}
                >
                  Start passage
                </Button>
              </div>
            ) : (
              <>
                {isGraded && passageScore && gradeResult && (
                  <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
                    <span className="text-sm font-medium text-gray-600">Score</span>
                    <Badge variant="outline" className="px-3 py-1 text-base">
                      {passageScore.correct}/{passageScore.total}
                    </Badge>
                    <span className="text-sm text-gray-400">·</span>
                    <span className="text-sm font-medium text-gray-600">
                      Estimated CLB
                    </span>
                    <Badge variant="success" className="px-3 py-1 text-base">
                      {gradeResult.estimatedBand}
                    </Badge>
                    {gradeResult.overallFeedback.trim() && (
                      <>
                        <span className="text-sm text-gray-400">·</span>
                        <span className="group relative inline-flex">
                          <button
                            type="button"
                            className="text-sm text-blue-600 hover:underline"
                            aria-label="Show overall feedback"
                            title={gradeResult.overallFeedback}
                          >
                            Overall feedback
                          </button>
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-72 rounded-md border border-gray-200 bg-white p-3 text-left text-xs font-normal normal-case text-gray-700 shadow-lg group-hover:block group-focus-within:block"
                          >
                            <MarkdownContent className="prose prose-sm max-w-none [&>:first-child]:mt-0">
                              {gradeResult.overallFeedback}
                            </MarkdownContent>
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                )}

                <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-2">
                  <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200">
                    <h3 className="shrink-0 border-b border-gray-200 px-4 py-2 text-sm font-semibold text-gray-900">
                      Practice passage
                    </h3>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                      <MarkdownContent className="prose prose-sm max-w-none [&>:first-child]:mt-0">
                        {examPrompt}
                      </MarkdownContent>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200">
                    <h3 className="shrink-0 border-b border-gray-200 px-4 py-2 text-sm font-semibold text-gray-900">
                      Questions
                    </h3>
                    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-3">
                      {questions.map((q, qIndex) => {
                        const result = readingResultsByIndex.get(qIndex);
                        const selectedIndex = answers[String(qIndex)];

                        return (
                          <fieldset
                            key={q.question}
                            className={`min-w-0 space-y-2 ${
                              result
                                ? result.isCorrect
                                  ? "rounded-md border border-green-200 bg-green-50/30 p-2"
                                  : "rounded-md border border-red-200 bg-red-50/30 p-2"
                                : ""
                            }`}
                            onFocusCapture={() => onQuestionFocus?.(qIndex)}
                            onPointerDownCapture={() => onQuestionFocus?.(qIndex)}
                          >
                            <legend className="flex w-full min-w-0 items-start gap-2 text-sm font-medium text-gray-900">
                              <span className="min-w-0 flex-1 break-words">
                                {qIndex + 1}. {q.question}
                              </span>
                              {isGraded && result && (
                                <GradedQuestionFeedback result={result} />
                              )}
                            </legend>
                            {q.options.map((option, oIndex) => {
                              const selected = selectedIndex === oIndex;
                              const isCorrectOption =
                                oIndex === q.correctAnswerIndex;

                              return (
                                <label
                                  key={option}
                                  className={getOptionClassName({
                                    selected,
                                    isCorrectOption,
                                    isGraded,
                                    inputLocked,
                                  })}
                                >
                                  <input
                                    type="radio"
                                    name={`q-${activePassageNumber}-${qIndex}`}
                                    checked={selected}
                                    onChange={() =>
                                      onAnswersChange({
                                        ...answers,
                                        [String(qIndex)]: oIndex,
                                      })
                                    }
                                    disabled={inputLocked || isGraded}
                                    className="mt-0.5 shrink-0"
                                  />
                                  <span className="min-w-0 flex-1 break-words">
                                    {option}
                                  </span>
                                </label>
                              );
                            })}
                            {isGraded && result && (
                              <GradedQuestionExplanation result={result} />
                            )}
                          </fieldset>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {!isGraded && (
                  <Button
                    onClick={onSubmit}
                    disabled={
                      readOnly ||
                      submitting ||
                      !allAnswered ||
                      currentPassageSubmitted
                    }
                    className="w-full shrink-0 sm:w-auto"
                  >
                    {submitting
                      ? "Grading..."
                      : currentPassageSubmitted
                        ? "Passage submitted"
                        : "Submit passage"}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
