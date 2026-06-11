"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownContent } from "@/components/ui/markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ConceptChatButton,
  ConceptChatPanel,
} from "@/components/session/ConceptChatPanel";
import { ConceptPracticeHistory } from "@/components/session/ConceptPracticeHistory";
import { formatConceptDuration } from "@/lib/concept-analytics";
import {
  getAcceptableAnswerIndexes,
  isMcDrillResponseComplete,
  isMultiSelectMcDrillItem,
  isMultipleChoiceDrillItem,
  mergeAcceptableAnswerIndexes,
  parseMcDrillSelectedIndexes,
  toggleMcDrillSelection,
} from "@/lib/concept-drill-mc";
import { getConceptSetScore } from "@/lib/concept-question-sets";
import type {
  ConceptChatContext,
  ConceptChatMessage,
  ConceptDrillItem,
  ConceptDrillResult,
  ConceptQuestionCheckResponse,
  ConceptQuestionCheckState,
  GradeResponse,
} from "@/lib/types";

export interface ConceptTabChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ConceptChatMessage[];
  onSend: (message: string) => Promise<void>;
  sending: boolean;
  conceptLabel: string;
  chatContext: ConceptChatContext;
}

interface QuestionSetOption {
  setNumber: number;
  label: string;
  isActive: boolean;
}

interface ConceptPracticeProps {
  conceptId?: string;
  document: string;
  questionSets: QuestionSetOption[];
  onSelectQuestionSet: (setNumber: number) => void;
  onNewQuestionSet: () => void;
  generatingNewSet?: boolean;
  generationError?: string | null;
  allowNewQuestionSets?: boolean;
  drillItems: ConceptDrillItem[];
  drillResponses: string[];
  onDrillChange: (index: number, value: string) => void;
  onSubmit: (
    questionTimings: Record<string, number>,
    sessionDurationSeconds: number,
  ) => void;
  onCheckQuestion?: (
    index: number,
    handlers?: { onHint?: (hint: string) => void },
  ) => Promise<ConceptQuestionCheckResponse>;
  onGradeQuestion?: (index: number) => Promise<ConceptDrillResult>;
  acceptableIndexesByQuestion?: Record<number, number[]>;
  acceptabilityResolving?: boolean;
  onAcceptableIndexesChange?: (index: number, indexes: number[]) => void;
  checkingQuestionIndex?: number | null;
  gradingQuestionIndex?: number | null;
  submitting: boolean;
  gradeResult?: GradeResponse | null;
  initialQuestionTimings?: Record<string, number>;
  initialSessionDurationSeconds?: number | null;
  instructionsChat?: ConceptTabChatProps;
  exercisesChat?: ConceptTabChatProps;
}

function DrillResultBadge({ isCorrect }: { isCorrect: boolean }) {
  return (
    <Badge variant={isCorrect ? "success" : "warning"}>
      {isCorrect ? "Correct" : "Incorrect"}
    </Badge>
  );
}

function QuestionTimerBadge({
  seconds,
  live = false,
}: {
  seconds: number;
  live?: boolean;
}) {
  return (
    <Badge variant="outline" className="shrink-0 text-xs tabular-nums">
      {live ? "⏱ " : ""}
      {formatConceptDuration(seconds)}
    </Badge>
  );
}

const tabPanelClass = "mt-3 flex min-h-0 flex-1 flex-col overflow-hidden";
const scrollPanelClass =
  "min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 px-4 py-3";

function finalizeQuestionTimings(
  questionTimings: Record<string, number>,
  activeQuestion: { index: number; enteredAt: number } | null,
): Record<string, number> {
  if (!activeQuestion) return questionTimings;

  const elapsed = (Date.now() - activeQuestion.enteredAt) / 1000;
  if (elapsed < 0.5) return questionTimings;

  const key = String(activeQuestion.index);
  return {
    ...questionTimings,
    [key]: Math.round((questionTimings[key] ?? 0) + elapsed),
  };
}

function getMcOptionsGridClass(options: string[]): string {
  const maxLength = Math.max(...options.map((option) => option.length));
  if (maxLength <= 24) return "mt-2 flex flex-wrap gap-2";
  if (maxLength <= 56) return "mt-2 grid grid-cols-2 gap-2";
  return "mt-2 grid grid-cols-1 gap-2";
}

function isCompactMcOptions(options: string[]): boolean {
  return Math.max(...options.map((option) => option.length)) <= 24;
}

function getOptionClassName({
  selected,
  isCorrectOption,
  isGraded,
  compact = false,
}: {
  selected: boolean;
  isCorrectOption: boolean;
  isGraded: boolean;
  compact?: boolean;
}): string {
  const layout = compact
    ? "inline-flex w-fit items-center gap-1.5 px-3 py-1.5"
    : "min-w-0 items-start gap-2 p-2";
  const base = `flex min-h-10 rounded-md border text-sm ${layout}`;

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

  return selected
    ? `${base} cursor-pointer border-blue-500 bg-blue-50`
    : `${base} cursor-pointer border-gray-200 hover:bg-gray-50`;
}

function isDrillResponseComplete(
  item: ConceptDrillItem,
  response: string | undefined,
  acceptableIndexes?: number[],
): boolean {
  if (isMultipleChoiceDrillItem(item)) {
    return isMcDrillResponseComplete(item, response, acceptableIndexes);
  }
  return Boolean(response?.trim());
}

export function ConceptPractice({
  conceptId,
  document,
  questionSets,
  onSelectQuestionSet,
  onNewQuestionSet,
  generatingNewSet = false,
  generationError = null,
  allowNewQuestionSets = true,
  drillItems,
  drillResponses,
  onDrillChange,
  onSubmit,
  onCheckQuestion,
  onGradeQuestion,
  acceptableIndexesByQuestion = {},
  acceptabilityResolving = false,
  onAcceptableIndexesChange,
  checkingQuestionIndex = null,
  gradingQuestionIndex = null,
  submitting,
  gradeResult,
  initialQuestionTimings = {},
  initialSessionDurationSeconds = null,
  instructionsChat,
  exercisesChat,
}: ConceptPracticeProps) {
  const [activeTab, setActiveTab] = useState("instructions");
  const allComplete = drillItems.every((item, index) =>
    isDrillResponseComplete(
      item,
      drillResponses[index],
      acceptableIndexesByQuestion[index],
    ),
  );

  const hasPerExerciseResults = Boolean(gradeResult?.drillResults?.length);
  const isGraded = Boolean(gradeResult && hasPerExerciseResults);

  const drillResultsByIndex = new Map(
    gradeResult?.drillResults?.map((r) => [r.index, r]) ?? [],
  );

  const setScore = getConceptSetScore(gradeResult, drillItems.length);

  const [questionTimings, setQuestionTimings] = useState<Record<string, number>>(
    () => initialQuestionTimings,
  );
  const sessionStartedAtRef = useRef<number | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [frozenSessionDuration, setFrozenSessionDuration] = useState<
    number | null
  >(initialSessionDurationSeconds);
  const activeQuestionRef = useRef<{ index: number; enteredAt: number } | null>(
    null,
  );
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(
    null,
  );
  const [activeElapsed, setActiveElapsed] = useState(0);
  const [questionChecks, setQuestionChecks] = useState<
    Record<number, ConceptQuestionCheckState>
  >({});

  const supportsIndividualGrading = Boolean(onCheckQuestion && onGradeQuestion);

  useEffect(() => {
    setQuestionTimings(initialQuestionTimings);
    activeQuestionRef.current = null;
    setActiveQuestionIndex(null);
    setActiveElapsed(0);
    setQuestionChecks({});

    if (isGraded) {
      sessionStartedAtRef.current = null;
      setSessionElapsed(initialSessionDurationSeconds ?? 0);
      setFrozenSessionDuration(initialSessionDurationSeconds);
      return;
    }

    if (drillItems.length > 0) {
      sessionStartedAtRef.current = Date.now();
      setSessionElapsed(0);
      setFrozenSessionDuration(null);
      return;
    }

    sessionStartedAtRef.current = null;
    setSessionElapsed(0);
    setFrozenSessionDuration(null);
  }, [
    initialQuestionTimings,
    initialSessionDurationSeconds,
    drillItems.length,
    isGraded,
  ]);

  const commitActiveQuestionTiming = useCallback(() => {
    const active = activeQuestionRef.current;
    if (!active) return;

    const elapsed = (Date.now() - active.enteredAt) / 1000;
    if (elapsed < 0.5) return;

    setQuestionTimings((prev) => {
      const key = String(active.index);
      return {
        ...prev,
        [key]: Math.round((prev[key] ?? 0) + elapsed),
      };
    });
    activeQuestionRef.current = {
      index: active.index,
      enteredAt: Date.now(),
    };
  }, []);

  const handleQuestionFocus = useCallback(
    (questionIndex: number) => {
      if (isGraded) return;

      const active = activeQuestionRef.current;
      if (active && active.index !== questionIndex) {
        commitActiveQuestionTiming();
      }

      activeQuestionRef.current = {
        index: questionIndex,
        enteredAt: Date.now(),
      };
      setActiveQuestionIndex(questionIndex);
      setActiveElapsed(0);
    },
    [commitActiveQuestionTiming, isGraded],
  );

  useEffect(() => {
    if (isGraded || drillItems.length === 0 || !sessionStartedAtRef.current) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!sessionStartedAtRef.current) return;
      setSessionElapsed(
        Math.floor((Date.now() - sessionStartedAtRef.current) / 1000),
      );
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isGraded, drillItems.length]);

  useEffect(() => {
    if (isGraded) return;

    const intervalId = window.setInterval(() => {
      const active = activeQuestionRef.current;
      if (!active) {
        setActiveElapsed(0);
        return;
      }
      setActiveElapsed(Math.floor((Date.now() - active.enteredAt) / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isGraded]);

  const getDisplayedQuestionSeconds = (index: number): number | null => {
    const result = drillResultsByIndex.get(index);
    if (result?.timeSpentSeconds != null) {
      return result.timeSpentSeconds;
    }

    const stored = questionTimings[String(index)];
    if (stored == null) return null;

    if (!isGraded && activeQuestionIndex === index) {
      return stored + activeElapsed;
    }

    return stored;
  };

  const perQuestionTimeSeconds = drillItems.reduce((sum, _, index) => {
    const seconds = getDisplayedQuestionSeconds(index);
    return seconds != null ? sum + seconds : sum;
  }, 0);

  const sessionTimeSeconds = isGraded
    ? (frozenSessionDuration ?? perQuestionTimeSeconds)
    : sessionElapsed;

  const handleDrillChange = (index: number, value: string) => {
    setQuestionChecks((prev) => {
      if (!(index in prev)) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
    onDrillChange(index, value);
  };

  const handleCheckQuestion = async (index: number) => {
    if (!onCheckQuestion) return;

    const item = drillItems[index];
    const response = drillResponses[index];
    if (!isDrillResponseComplete(item, response)) return;

    setQuestionChecks((prev) => ({
      ...prev,
      [index]: { phase: "checking", hint: "" },
    }));

    try {
      const result = await onCheckQuestion(index, {
        onHint: (hint) => {
          setQuestionChecks((prev) => ({
            ...prev,
            [index]: { phase: "checking", hint },
          }));
        },
      });
      if (result.acceptableAnswerIndexes?.length) {
        onAcceptableIndexesChange?.(
          index,
          mergeAcceptableAnswerIndexes(
            getAcceptableAnswerIndexes(
              item,
              acceptableIndexesByQuestion[index],
            ),
            result.acceptableAnswerIndexes,
          ),
        );
      }
      if (result.isCorrect) {
        setQuestionChecks((prev) => ({
          ...prev,
          [index]: { phase: "correct" },
        }));
        return;
      }

      setQuestionChecks((prev) => ({
        ...prev,
        [index]: {
          phase: "hint",
          hint:
            result.hint?.trim() ||
            item.hint ||
            "Review the instructions and try a different answer.",
        },
      }));
    } catch {
      setQuestionChecks((prev) => {
        if (prev[index]?.phase !== "checking") return prev;
        const next = { ...prev };
        delete next[index];
        return next;
      });
      // Parent surfaces API errors.
    }
  };

  const handleGradeQuestion = async (index: number) => {
    if (!onGradeQuestion) return;

    try {
      const result = await onGradeQuestion(index);
      setQuestionChecks((prev) => ({
        ...prev,
        [index]: { phase: "graded", result },
      }));
    } catch {
      // Parent surfaces API errors.
    }
  };

  const handleSubmitClick = () => {
    const finalSessionDuration = sessionStartedAtRef.current
      ? Math.round((Date.now() - sessionStartedAtRef.current) / 1000)
      : sessionElapsed;
    sessionStartedAtRef.current = null;
    setSessionElapsed(finalSessionDuration);
    setFrozenSessionDuration(finalSessionDuration);

    const finalTimings = finalizeQuestionTimings(
      questionTimings,
      activeQuestionRef.current,
    );
    activeQuestionRef.current = null;
    setActiveQuestionIndex(null);
    setActiveElapsed(0);
    setQuestionTimings(finalTimings);
    onSubmit(finalTimings, finalSessionDuration);
  };

  const showHistoryTab = Boolean(conceptId);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    instructionsChat?.onOpenChange(false);
    exercisesChat?.onOpenChange(false);
  };

  const renderChatPanel = (chat?: ConceptTabChatProps) => {
    if (!chat) return null;

    return (
      <ConceptChatPanel
        open={chat.open}
        onOpenChange={chat.onOpenChange}
        conceptLabel={chat.conceptLabel}
        chatContext={chat.chatContext}
        messages={chat.messages}
        onSend={chat.onSend}
        sending={chat.sending}
      />
    );
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex min-h-0 flex-1 flex-col"
    >
      <TabsList
        className={`grid h-auto w-full shrink-0 gap-1 ${showHistoryTab ? "grid-cols-3" : "grid-cols-2"}`}
      >
        <TabsTrigger value="instructions" className="text-xs sm:text-sm">
          Instructions
        </TabsTrigger>
        <TabsTrigger value="exercises" className="text-xs sm:text-sm">
          Exercises
        </TabsTrigger>
        {showHistoryTab && (
          <TabsTrigger value="history" className="text-xs sm:text-sm">
            History
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="instructions" className={tabPanelClass}>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={`relative ${scrollPanelClass}`}>
            {instructionsChat && (
              <div className="absolute right-2 top-2 z-10">
                <ConceptChatButton
                  onClick={() => instructionsChat.onOpenChange(true)}
                  className="bg-white/90 shadow-sm hover:bg-white"
                />
              </div>
            )}
            <div className="prose prose-sm max-w-none pr-10 [&>:first-child]:mt-0">
              <MarkdownContent>{document}</MarkdownContent>
            </div>
          </div>
          {renderChatPanel(instructionsChat)}
        </div>
      </TabsContent>

      {showHistoryTab && conceptId && (
        <TabsContent value="history" className={tabPanelClass}>
          <div className={scrollPanelClass}>
            <ConceptPracticeHistory conceptId={conceptId} variant="tab" />
          </div>
        </TabsContent>
      )}

      <TabsContent value="exercises" className={tabPanelClass}>
        <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          {renderChatPanel(exercisesChat)}
          <div className="shrink-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:max-w-sm">
                <select
                  id="concept-question-set"
                  value={
                    questionSets.find((set) => set.isActive)?.setNumber ??
                    questionSets[0]?.setNumber ??
                    1
                  }
                  onChange={(event) =>
                    onSelectQuestionSet(Number(event.target.value))
                  }
                  disabled={questionSets.length === 0}
                  className="flex h-8 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {questionSets.map((set) => (
                    <option key={set.setNumber} value={set.setNumber}>
                      {set.label}
                    </option>
                  ))}
                </select>
                {allowNewQuestionSets && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={onNewQuestionSet}
                    disabled={generatingNewSet}
                  >
                    {generatingNewSet ? "Generating..." : "New question set"}
                  </Button>
                )}
              </div>
              {generationError && (
                <p className="text-sm text-red-600">{generationError}</p>
              )}
              {exercisesChat && (
                <ConceptChatButton
                  onClick={() => exercisesChat.onOpenChange(true)}
                  className="shrink-0"
                />
              )}
            </div>

            {isGraded && setScore && gradeResult && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <span className="text-sm font-medium text-gray-600">Score</span>
                <Badge variant="outline" className="text-base px-3 py-1">
                  {setScore.correct}/{setScore.total}
                </Badge>
                <span className="text-sm text-gray-400">·</span>
                <span className="text-sm font-medium text-gray-600">Total time</span>
                <Badge variant="outline" className="text-base px-3 py-1 tabular-nums">
                  {formatConceptDuration(sessionTimeSeconds)}
                </Badge>
                {setScore.total > 0 && sessionTimeSeconds > 0 && (
                  <>
                    <span className="text-sm text-gray-400">·</span>
                    <span className="text-sm font-medium text-gray-600">
                      Avg per question
                    </span>
                    <Badge variant="outline" className="text-base px-3 py-1 tabular-nums">
                      {formatConceptDuration(
                        Math.round(sessionTimeSeconds / setScore.total),
                      )}
                    </Badge>
                  </>
                )}
                <span className="text-sm text-gray-400">·</span>
                <span className="text-sm font-medium text-gray-600">Estimated CLB</span>
                <Badge variant="success" className="text-base px-3 py-1">
                  {gradeResult.estimatedBand}
                </Badge>
              </div>
            )}

            {!isGraded && drillItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2">
                <span className="text-sm font-medium text-blue-900">Elapsed</span>
                <Badge variant="outline" className="tabular-nums">
                  {formatConceptDuration(sessionTimeSeconds)}
                </Badge>
              </div>
            )}

            {!isGraded && drillItems.length > 0 && (
              <p className="text-xs text-gray-500">
                Timer starts when the question set loads and stops when you
                submit. Per-question time tracks while you work on each exercise.
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {drillItems.map((item, index) => {
              const bulkResult = drillResultsByIndex.get(index);
              const questionCheck = questionChecks[index];
              const individualResult =
                !isGraded && questionCheck?.phase === "graded"
                  ? questionCheck.result
                  : undefined;
              const result = isGraded ? bulkResult : individualResult;
              const showMcGradedStyles =
                isGraded || questionCheck?.phase === "graded";
              const questionSeconds = getDisplayedQuestionSeconds(index);
              const isActive = !isGraded && activeQuestionIndex === index;
              const isMc = isMultipleChoiceDrillItem(item);
              const acceptableIndexes = getAcceptableAnswerIndexes(
                item,
                acceptableIndexesByQuestion[index],
              );
              const isMultiSelect = isMultiSelectMcDrillItem(
                item,
                acceptableIndexes,
              );
              const selectedIndexes = isMc
                ? parseMcDrillSelectedIndexes(drillResponses[index] ?? "")
                : [];
              const responseComplete = isDrillResponseComplete(
                item,
                drillResponses[index],
                acceptableIndexes,
              );
              const isChecking = checkingQuestionIndex === index;
              const isGradingQuestion = gradingQuestionIndex === index;
              const showCorrectOnly =
                !isGraded && questionCheck?.phase === "correct";
                      const isStreamingHint =
                !isGraded && questionCheck?.phase === "checking";
              const showHint =
                !isGraded &&
                (questionCheck?.phase === "hint" || isStreamingHint);

              return (
                <div
                  key={index}
                  className={`rounded-lg border p-3 ${
                    result
                      ? result.isCorrect
                        ? "border-green-200 bg-green-50/50"
                        : "border-red-200 bg-red-50/50"
                      : showCorrectOnly
                        ? "border-green-200 bg-green-50/50"
                        : isActive
                        ? "border-blue-200 bg-blue-50/30"
                        : "border-gray-200"
                  }`}
                  onFocusCapture={() => handleQuestionFocus(index)}
                  onPointerDownCapture={() => handleQuestionFocus(index)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800">
                      {index + 1}.{" "}
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <span>{children}</span>,
                          strong: ({ children }) => (
                            <strong className="font-semibold">{children}</strong>
                          ),
                        }}
                      >
                        {item.prompt}
                      </ReactMarkdown>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {questionSeconds != null && questionSeconds > 0 && (
                        <QuestionTimerBadge
                          seconds={questionSeconds}
                          live={isActive}
                        />
                      )}
                      {result && <DrillResultBadge isCorrect={result.isCorrect} />}
                      {showCorrectOnly && <DrillResultBadge isCorrect />}
                    </div>
                  </div>
                  {isMc && isMultiSelect && !isGraded && !acceptabilityResolving && (
                    <p className="mt-1 text-xs text-gray-500">
                      More than one answer may work — select all that fit.
                    </p>
                  )}
                  {isMc && acceptabilityResolving && !isGraded ? (
                    <p className="mt-2 text-xs text-gray-500">
                      Preparing answer options…
                    </p>
                  ) : isMc ? (
                    <div className="mt-2 flex items-center gap-3">
                      <div
                        className={`min-w-0 flex-1 ${getMcOptionsGridClass(item.options).replace(/^mt-2 /, "")}`}
                      >
                        {item.options.map((option, optionIndex) => {
                          const selected = selectedIndexes.includes(optionIndex);
                          const isCorrectOption = showMcGradedStyles
                            ? acceptableIndexes.includes(optionIndex)
                            : optionIndex === item.correctAnswerIndex;
                          const compact = isCompactMcOptions(item.options);

                          return (
                            <label
                              key={`${index}-${optionIndex}`}
                              className={getOptionClassName({
                                selected,
                                isCorrectOption,
                                isGraded: showMcGradedStyles,
                                compact,
                              })}
                            >
                              <input
                                type={isMultiSelect ? "checkbox" : "radio"}
                                name={`concept-drill-${index}`}
                                checked={selected}
                                onChange={() =>
                                  handleDrillChange(
                                    index,
                                    toggleMcDrillSelection(
                                      drillResponses[index] ?? "",
                                      optionIndex,
                                      isMultiSelect,
                                    ),
                                  )
                                }
                                disabled={isGraded}
                                className="shrink-0"
                              />
                              <span
                                className={
                                  compact
                                    ? "min-w-0 truncate"
                                    : "min-w-0 flex-1 break-words"
                                }
                              >
                                {option}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {supportsIndividualGrading &&
                        !isGraded &&
                        questionCheck?.phase !== "graded" &&
                        (questionCheck?.phase === "hint" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 self-center"
                            onClick={() => void handleGradeQuestion(index)}
                            disabled={isGradingQuestion || !responseComplete}
                          >
                            {isGradingQuestion ? "Grading..." : "Show answer"}
                          </Button>
                        ) : questionCheck?.phase !== "correct" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 self-center"
                            onClick={() => void handleCheckQuestion(index)}
                            disabled={
                              acceptabilityResolving ||
                              isChecking ||
                              isGradingQuestion ||
                              !responseComplete
                            }
                          >
                            {isChecking ? "Checking..." : "Check answer"}
                          </Button>
                        ) : null)}
                    </div>
                  ) : (
                    <Input
                      className="mt-2 max-w-xs"
                      value={drillResponses[index] ?? ""}
                      onChange={(e) => handleDrillChange(index, e.target.value)}
                      onFocus={() => handleQuestionFocus(index)}
                      onPointerDown={() => handleQuestionFocus(index)}
                      placeholder="Your answer"
                      disabled={isGraded}
                      readOnly={isGraded}
                    />
                  )}
                  {showHint && (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <span className="font-medium">Hint: </span>
                      {questionCheck.hint ||
                        (isStreamingHint ? (
                          <span className="text-amber-700/70">…</span>
                        ) : null)}
                      {isStreamingHint && questionCheck.hint && (
                        <span
                          className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-amber-700 align-middle"
                          aria-hidden
                        />
                      )}
                    </div>
                  )}
                  {result && (
                    <div className="mt-2 space-y-1 text-sm">
                      {!result.isCorrect && (
                        <p>
                          <span className="font-medium text-gray-600">
                            Correct answer:{" "}
                          </span>
                          <span className="font-medium text-green-700">
                            {result.correctAnswer}
                          </span>
                        </p>
                      )}
                      <p className="text-gray-600">{result.feedback}</p>
                    </div>
                  )}
                  {supportsIndividualGrading && !isGraded && !isMc && (
                    <div className="mt-3">
                      {questionCheck?.phase === "hint" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleGradeQuestion(index)}
                          disabled={isGradingQuestion || !responseComplete}
                        >
                          {isGradingQuestion ? "Grading..." : "Show answer"}
                        </Button>
                      ) : questionCheck?.phase !== "graded" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleCheckQuestion(index)}
                          disabled={
                            acceptabilityResolving ||
                            isChecking ||
                            isGradingQuestion ||
                            !responseComplete ||
                            questionCheck?.phase === "correct"
                          }
                        >
                          {isChecking ? "Checking..." : "Check answer"}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!isGraded && (
            <div className="shrink-0 border-t border-gray-100 pt-4">
              <Button
                onClick={handleSubmitClick}
                disabled={submitting || !allComplete || drillItems.length === 0}
                className="w-full sm:w-auto"
              >
                {submitting ? "Grading..." : "Submit for Grading"}
              </Button>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
