"use client";

import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { MarkdownContent } from "@/components/ui/markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ConceptDrillItem, GradeResponse } from "@/lib/types";
import { getConceptSetScore } from "@/lib/concept-question-sets";

interface QuestionSetOption {
  setNumber: number;
  label: string;
  isActive: boolean;
}

interface ConceptPracticeProps {
  document: string;
  questionSets: QuestionSetOption[];
  onSelectQuestionSet: (setNumber: number) => void;
  onNewQuestionSet: () => void;
  generatingNewSet?: boolean;
  allowNewQuestionSets?: boolean;
  examPrompt: string;
  drillItems: ConceptDrillItem[];
  drillResponses: string[];
  onDrillChange: (index: number, value: string) => void;
  writingResponse: string;
  onWritingChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  gradeResult?: GradeResponse | null;
}

function DrillResultBadge({ isCorrect }: { isCorrect: boolean }) {
  return (
    <Badge variant={isCorrect ? "success" : "warning"}>
      {isCorrect ? "Correct" : "Incorrect"}
    </Badge>
  );
}

const tabPanelClass = "mt-3 flex min-h-0 flex-1 flex-col overflow-hidden";
const scrollPanelClass =
  "min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 px-4 py-3";

export function ConceptPractice({
  document,
  questionSets,
  onSelectQuestionSet,
  onNewQuestionSet,
  generatingNewSet = false,
  allowNewQuestionSets = true,
  examPrompt,
  drillItems,
  drillResponses,
  onDrillChange,
  writingResponse,
  onWritingChange,
  onSubmit,
  submitting,
  gradeResult,
}: ConceptPracticeProps) {
  const drillsComplete = drillItems.every((_, i) => drillResponses[i]?.trim());
  const allComplete = drillsComplete && writingResponse.trim();

  const hasPerExerciseResults = Boolean(
    gradeResult?.drillResults?.length || gradeResult?.writingResult,
  );
  const isGraded = Boolean(gradeResult && hasPerExerciseResults);

  const drillResultsByIndex = new Map(
    gradeResult?.drillResults?.map((r) => [r.index, r]) ?? [],
  );

  const setScore = getConceptSetScore(gradeResult, drillItems.length);

  return (
    <Tabs defaultValue="instructions" className="flex min-h-0 flex-1 flex-col">
      <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 gap-1">
        <TabsTrigger value="instructions" className="text-xs sm:text-sm">
          Instructions
        </TabsTrigger>
        <TabsTrigger value="exercises" className="text-xs sm:text-sm">
          Exercises
        </TabsTrigger>
      </TabsList>

      <TabsContent value="instructions" className={tabPanelClass}>
        <div className={scrollPanelClass}>
          <div className="prose prose-sm max-w-none [&>:first-child]:mt-0">
            <MarkdownContent>{document}</MarkdownContent>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="exercises" className={tabPanelClass}>
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="shrink-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {questionSets.map((set) => (
                <Button
                  key={set.setNumber}
                  type="button"
                  size="sm"
                  variant={set.isActive ? "default" : "outline"}
                  onClick={() => onSelectQuestionSet(set.setNumber)}
                >
                  {set.label}
                </Button>
              ))}
              {allowNewQuestionSets && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onNewQuestionSet}
                  disabled={generatingNewSet}
                >
                  {generatingNewSet ? "Generating..." : "New question set"}
                </Button>
              )}
            </div>

            {isGraded && setScore && gradeResult && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <span className="text-sm font-medium text-gray-600">Score</span>
                <Badge variant="outline" className="text-base px-3 py-1">
                  {setScore.correct}/{setScore.total}
                </Badge>
                <span className="text-sm text-gray-400">·</span>
                <span className="text-sm font-medium text-gray-600">Estimated CLB</span>
                <Badge variant="success" className="text-base px-3 py-1">
                  {gradeResult.estimatedBand}
                </Badge>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {drillItems.map((item, index) => {
              const result = drillResultsByIndex.get(index);
              return (
                <div
                  key={index}
                  className={`rounded-lg border p-3 ${
                    result
                      ? result.isCorrect
                        ? "border-green-200 bg-green-50/50"
                        : "border-red-200 bg-red-50/50"
                      : "border-gray-200"
                  }`}
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
                    {result && <DrillResultBadge isCorrect={result.isCorrect} />}
                  </div>
                  {item.hint && !isGraded && (
                    <p className="mt-1 text-xs text-gray-500">Hint: {item.hint}</p>
                  )}
                  <Input
                    className="mt-2 max-w-xs"
                    value={drillResponses[index] ?? ""}
                    onChange={(e) => onDrillChange(index, e.target.value)}
                    placeholder="Your answer"
                    disabled={isGraded}
                    readOnly={isGraded}
                  />
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
                </div>
              );
            })}

            <div
              className={`rounded-lg border p-3 ${
                gradeResult?.writingResult
                  ? gradeResult.writingResult.isAcceptable
                    ? "border-green-200 bg-green-50/50"
                    : "border-amber-200 bg-amber-50/50"
                  : "border-blue-200 bg-blue-50/50"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800">
                  {drillItems.length + 1}. Mini writing
                </p>
                {gradeResult?.writingResult && (
                  <DrillResultBadge
                    isCorrect={gradeResult.writingResult.isAcceptable}
                  />
                )}
              </div>
              <div className="prose prose-sm mt-1 max-w-none text-gray-700">
                <ReactMarkdown>{examPrompt}</ReactMarkdown>
              </div>
              <Textarea
                className="mt-2 min-h-[6rem]"
                rows={4}
                value={writingResponse}
                onChange={(e) => onWritingChange(e.target.value)}
                placeholder="Write 2–3 sentences applying the concept..."
                disabled={isGraded}
                readOnly={isGraded}
              />
              {gradeResult?.writingResult && (
                <p className="mt-2 text-sm text-gray-600">
                  {gradeResult.writingResult.feedback}
                </p>
              )}
            </div>
          </div>

          {!isGraded && (
            <div className="shrink-0 border-t border-gray-100 pt-4">
              <Button
                onClick={onSubmit}
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
