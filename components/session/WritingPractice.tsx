"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ExamCountdownDisplay,
  useExamCountdown,
} from "@/components/session/ExamCountdown";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/input";
import {
  getWritingExamTimeLimitLabel,
  getWritingExamTimeLimitSeconds,
} from "@/lib/exam-timing";
import { getThemedWritingStartCopy } from "@/lib/exercise-types";
import { cn, countWords } from "@/lib/utils";

interface WritingPracticeProps {
  instructions: string;
  example: string;
  examPrompt: string;
  practiceType: string;
  focusTarget: string;
  sessionGoal: string;
  grammarFocus?: string;
  strategy?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  disabled?: boolean;
  onFillTestResponse?: () => void;
  fillingTestResponse?: boolean;
  defaultTab?: "instructions" | "focus" | "prompt" | "example";
}

const TARGET_MIN = 150;
const TARGET_MAX = 200;

const tabPanelClass = "mt-3 flex min-h-0 flex-1 flex-col overflow-hidden";
const scrollPanelClass =
  "min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 px-4 py-3";

export function WritingPractice({
  instructions,
  example,
  examPrompt,
  practiceType,
  focusTarget,
  sessionGoal,
  grammarFocus,
  strategy,
  value,
  onChange,
  onSubmit,
  submitting,
  disabled,
  onFillTestResponse,
  fillingTestResponse,
  defaultTab = "instructions",
}: WritingPracticeProps) {
  const [questionStarted, setQuestionStarted] = useState(false);
  const timeLimitSeconds = getWritingExamTimeLimitSeconds(practiceType);
  const timeLimitLabel = getWritingExamTimeLimitLabel(practiceType);
  const startCopy = getThemedWritingStartCopy({
    focusTarget,
    suggestedTimeLabel: timeLimitLabel,
    practiceType,
  });
  const { remaining, expired } = useExamCountdown(
    timeLimitSeconds,
    questionStarted,
  );
  const wordCount = countWords(value);
  const inRange = wordCount >= TARGET_MIN && wordCount <= TARGET_MAX;
  const inputLocked = disabled || expired;

  return (
    <Tabs defaultValue={defaultTab} className="flex min-h-0 w-full flex-1 flex-col">
      <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 gap-1 sm:grid-cols-4">
        <TabsTrigger value="instructions" className="text-xs sm:text-sm">
          Instructions
        </TabsTrigger>
        <TabsTrigger value="focus" className="text-xs sm:text-sm">
          Session Focus
        </TabsTrigger>
        <TabsTrigger value="prompt" className="text-xs sm:text-sm">
          Prompt/Response
        </TabsTrigger>
        <TabsTrigger value="example" className="text-xs sm:text-sm">
          High Score Example
        </TabsTrigger>
      </TabsList>

      <TabsContent value="instructions" className={tabPanelClass}>
        <div className={scrollPanelClass}>
          <div className="prose prose-sm max-w-none [&>:first-child]:mt-0">
            <ReactMarkdown>{instructions}</ReactMarkdown>
          </div>
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
                <h3 className="text-sm font-semibold text-gray-900">Grammar Focus</h3>
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

      <TabsContent value="prompt" className={tabPanelClass}>
        {!questionStarted ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-gray-900">
                {startCopy.title}
              </h3>
              <p className="max-w-sm text-sm text-gray-600">{startCopy.body}</p>
            </div>
            <Button
              type="button"
              size="lg"
              onClick={() => setQuestionStarted(true)}
              disabled={disabled}
            >
              Start practice prompt
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <ExamCountdownDisplay remaining={remaining} expired={expired} />

            <div className="max-h-48 shrink-0 overflow-y-auto rounded-lg border border-gray-200 px-4 py-3">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">
                Practice prompt
              </h3>
              <div className="prose prose-sm max-w-none [&>:first-child]:mt-0">
                <ReactMarkdown>{examPrompt}</ReactMarkdown>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Your Response
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {onFillTestResponse && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onFillTestResponse}
                      disabled={inputLocked || fillingTestResponse}
                    >
                      {fillingTestResponse
                        ? "Generating…"
                        : "Fill test response (AI)"}
                    </Button>
                  )}
                  <span
                    className={cn(
                      "text-sm font-medium",
                      inRange ? "text-green-600" : "text-amber-600",
                    )}
                  >
                    {wordCount} words (target: {TARGET_MIN}–{TARGET_MAX})
                  </span>
                </div>
              </div>
              <div className="relative min-h-0 flex-1">
                <Textarea
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Write your response here..."
                  disabled={inputLocked}
                  className="absolute inset-0 h-full min-h-0 resize-none"
                />
              </div>
              {expired && (
                <p className="mt-1 shrink-0 text-xs text-red-600">
                  Time is up. You can still submit what you have written.
                </p>
              )}
              {!inRange && wordCount > 0 && !expired && (
                <p className="mt-1 shrink-0 text-xs text-amber-600">
                  CELPIP writing tasks typically require {TARGET_MIN}–
                  {TARGET_MAX} words.
                </p>
              )}
            </div>

            <Button
              onClick={onSubmit}
              disabled={disabled || submitting || wordCount < 20}
              className="w-full shrink-0 sm:w-auto"
            >
              {submitting ? "Grading..." : "Submit practice response"}
            </Button>
          </div>
        )}
      </TabsContent>

      <TabsContent value="example" className={tabPanelClass}>
        <div className={scrollPanelClass}>
          <div className="prose prose-sm max-w-none [&>:first-child]:mt-0">
            <ReactMarkdown>{example}</ReactMarkdown>
          </div>
        </div>
      </TabsContent>

    </Tabs>
  );
}
