"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReadingQuestion } from "@/lib/types";

interface ReadingPracticeProps {
  instructions: string;
  example: string;
  examPrompt: string;
  questions: ReadingQuestion[];
  onSubmit: (answers: Record<string, number>) => void;
  submitting: boolean;
  disabled?: boolean;
}

export function ReadingPractice({
  instructions,
  example,
  examPrompt,
  questions,
  onSubmit,
  submitting,
  disabled,
}: ReadingPracticeProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showExample, setShowExample] = useState(false);

  const allAnswered =
    questions.length > 0 &&
    questions.every((_, i) => answers[String(i)] !== undefined);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instructions</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <ReactMarkdown>{instructions}</ReactMarkdown>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowExample(!showExample)}
      >
        {showExample ? "Hide" : "Show"} Strategy Walkthrough
      </Button>
      {showExample && (
        <Card>
          <CardContent className="prose prose-sm max-w-none pt-4">
            <ReactMarkdown>{example}</ReactMarkdown>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reading Passage</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-h-[480px] max-w-none overflow-y-auto">
            <ReactMarkdown>{examPrompt}</ReactMarkdown>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Questions</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[480px] space-y-6 overflow-y-auto">
            {questions.map((q, qIndex) => (
              <fieldset key={q.question} className="space-y-2">
                <legend className="text-sm font-medium text-gray-900">
                  {qIndex + 1}. {q.question}
                </legend>
                {q.options.map((option, oIndex) => (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${
                      answers[String(qIndex)] === oIndex
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${qIndex}`}
                      checked={answers[String(qIndex)] === oIndex}
                      onChange={() =>
                        setAnswers((prev) => ({ ...prev, [String(qIndex)]: oIndex }))
                      }
                      disabled={disabled}
                      className="mt-0.5"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </fieldset>
            ))}
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={() => onSubmit(answers)}
        disabled={disabled || submitting || !allAnswered}
        className="w-full sm:w-auto"
      >
        {submitting ? "Grading..." : "Submit Exam Response"}
      </Button>
    </div>
  );
}
