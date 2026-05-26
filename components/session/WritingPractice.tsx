"use client";

import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/input";
import { cn, countWords } from "@/lib/utils";

interface WritingPracticeProps {
  instructions: string;
  example: string;
  examPrompt: string;
  sessionGoal: string;
  grammarFocus?: string;
  strategy?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  disabled?: boolean;
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
  sessionGoal,
  grammarFocus,
  strategy,
  value,
  onChange,
  onSubmit,
  submitting,
  disabled,
}: WritingPracticeProps) {
  const wordCount = countWords(value);
  const inRange = wordCount >= TARGET_MIN && wordCount <= TARGET_MAX;

  return (
    <Tabs defaultValue="instructions" className="flex min-h-0 flex-1 flex-col">
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
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="max-h-48 shrink-0 overflow-y-auto rounded-lg border border-gray-200 px-4 py-3">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Exam Prompt</h3>
            <div className="prose prose-sm max-w-none [&>:first-child]:mt-0">
              <ReactMarkdown>{examPrompt}</ReactMarkdown>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Your Response</label>
              <span
                className={cn(
                  "text-sm font-medium",
                  inRange ? "text-green-600" : "text-amber-600",
                )}
              >
                {wordCount} words (target: {TARGET_MIN}–{TARGET_MAX})
              </span>
            </div>
            <div className="relative min-h-0 flex-1">
              <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Write your response here..."
                disabled={disabled}
                className="absolute inset-0 h-full min-h-0 resize-none"
              />
            </div>
            {!inRange && wordCount > 0 && (
              <p className="mt-1 shrink-0 text-xs text-amber-600">
                CELPIP writing tasks typically require {TARGET_MIN}–{TARGET_MAX} words.
              </p>
            )}
          </div>

          <Button
            onClick={onSubmit}
            disabled={disabled || submitting || wordCount < 20}
            className="w-full shrink-0 sm:w-auto"
          >
            {submitting ? "Grading..." : "Submit Exam Response"}
          </Button>
        </div>
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
