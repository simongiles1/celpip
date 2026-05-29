"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WordPronunciationButton } from "@/components/session/WordPronunciationButton";
import type {
  VocabularyProgress,
  VocabularyQuestion,
  VocabularyQuestionAnswerState,
  VocabularyQuestionType,
  VocabularyWord,
} from "@/lib/types";
import {
  hydrateVocabularyAnswersByWord,
  serializeVocabularyProgress,
} from "@/lib/vocabulary-progress";
import { isMultiSelectAnswerCorrect } from "@/lib/vocabulary-validation";
import { cn } from "@/lib/utils";

const QUESTION_TYPE_LABELS: Record<VocabularyQuestionType, string> = {
  definition_choice: "Choose the definition",
  word_fit_select: "Check all that apply",
  synonym_choice: "Choose the synonym",
};

interface QuestionAnswerState extends VocabularyQuestionAnswerState {}

function QuestionResultBadge({ isCorrect }: { isCorrect: boolean }) {
  return (
    <Badge variant={isCorrect ? "success" : "warning"}>
      {isCorrect ? "Correct" : "Incorrect"}
    </Badge>
  );
}

function getSingleSelectOptionClassName({
  selected,
  isCorrectOption,
  checked,
}: {
  selected: boolean;
  isCorrectOption: boolean;
  checked: boolean;
}): string {
  const base =
    "flex w-full min-w-0 items-start gap-2 rounded-md border p-2 text-sm";

  if (!checked) {
    return cn(
      base,
      "cursor-pointer border-gray-200 hover:bg-gray-50",
      selected && "border-blue-500 bg-blue-50",
    );
  }

  if (selected && isCorrectOption) {
    return `${base} border-green-500 bg-green-50`;
  }
  if (selected && !isCorrectOption) {
    return `${base} border-red-500 bg-red-50`;
  }
  if (isCorrectOption) {
    return `${base} border-green-300 bg-green-50/70`;
  }
  return `${base} border-gray-200 opacity-80`;
}

function getMultiSelectOptionClassName({
  selected,
  shouldBeSelected,
  checked,
}: {
  selected: boolean;
  shouldBeSelected: boolean;
  checked: boolean;
}): string {
  const base =
    "flex w-full min-w-0 items-start gap-2 rounded-md border p-2 text-sm";

  if (!checked) {
    return cn(
      base,
      "cursor-pointer border-gray-200 hover:bg-gray-50",
      selected && "border-blue-500 bg-blue-50",
    );
  }

  if (selected && shouldBeSelected) {
    return `${base} border-green-500 bg-green-50`;
  }
  if (selected && !shouldBeSelected) {
    return `${base} border-red-500 bg-red-50`;
  }
  if (!selected && shouldBeSelected) {
    return `${base} border-green-300 bg-green-50/70`;
  }
  return `${base} border-gray-200 opacity-80`;
}

function VocabularyQuestionCard({
  question,
  questionNumber,
  state,
  onSelectOption,
  onToggleMultiSelect,
  onCheckMultiSelect,
}: {
  question: VocabularyQuestion;
  questionNumber: number;
  state: QuestionAnswerState;
  onSelectOption: (index: number) => void;
  onToggleMultiSelect: (index: number) => void;
  onCheckMultiSelect: () => void;
}) {
  const isSingleSelect =
    question.type === "definition_choice" ||
    question.type === "synonym_choice";
  const isMultiSelect = question.type === "word_fit_select";
  const correctIndexes = question.correctAnswerIndexes ?? [];

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        state.checked
          ? state.isCorrect
            ? "border-green-200 bg-green-50/40"
            : "border-red-200 bg-red-50/40"
          : "border-gray-200 bg-white",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <Badge variant="outline" className="text-xs">
            {QUESTION_TYPE_LABELS[question.type]}
          </Badge>
          <p className="text-sm font-medium text-gray-900">
            {questionNumber}. {question.prompt}
          </p>
        </div>
        {state.checked && state.isCorrect != null && (
          <QuestionResultBadge isCorrect={state.isCorrect} />
        )}
      </div>

      {isSingleSelect && question.options && (
        <div className="mt-3 space-y-2">
          {question.options.map((option, optionIndex) => {
            const selected = state.selectedIndex === optionIndex;
            const isCorrectOption =
              optionIndex === question.correctAnswerIndex;

            return (
              <button
                key={option}
                type="button"
                disabled={state.checked}
                onClick={() => onSelectOption(optionIndex)}
                className={getSingleSelectOptionClassName({
                  selected,
                  isCorrectOption,
                  checked: state.checked,
                })}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]",
                    selected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300",
                  )}
                  aria-hidden="true"
                >
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span className="min-w-0 flex-1 break-words text-left">
                  {option}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {isMultiSelect && question.options && (
        <div className="mt-3 space-y-2">
          {question.options.map((option, optionIndex) => {
            const selected = state.selectedIndexes?.includes(optionIndex) ?? false;
            const shouldBeSelected = correctIndexes.includes(optionIndex);

            return (
              <label
                key={option}
                className={getMultiSelectOptionClassName({
                  selected,
                  shouldBeSelected,
                  checked: state.checked,
                })}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={state.checked}
                  onChange={() => onToggleMultiSelect(optionIndex)}
                  className="mt-0.5 shrink-0"
                />
                <span className="min-w-0 flex-1 break-words">{option}</span>
              </label>
            );
          })}
          {!state.checked && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCheckMultiSelect}
              disabled={!state.selectedIndexes?.length}
              className="mt-1"
            >
              Check
            </Button>
          )}
        </div>
      )}

      {state.checked && question.explanation && (
        <p className="mt-3 text-sm text-gray-600">{question.explanation}</p>
      )}

      {state.checked &&
        !state.isCorrect &&
        isMultiSelect &&
        correctIndexes.length > 0 &&
        question.options && (
          <p className="mt-2 text-sm font-medium text-green-700">
            Correct answers:{" "}
            {correctIndexes.map((index) => question.options?.[index]).join(", ")}
          </p>
        )}
    </div>
  );
}

function VocabularyReferenceCard({ word }: { word: VocabularyWord }) {
  return (
    <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50/50 p-4 text-sm">
      <p className="font-medium text-gray-900">Word reference</p>
      <p className="text-gray-800">{word.definition}</p>
      {word.spokenAlternative && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          <span className="font-medium">Instead of saying </span>
          &ldquo;{word.spokenAlternative}&rdquo;
          <span className="font-medium"> in writing, use </span>
          &ldquo;{word.word}&rdquo;.
        </p>
      )}
      <blockquote className="border-l-4 border-teal-500 pl-3 italic text-gray-700">
        {word.exampleSentence}
      </blockquote>
      <p className="text-gray-600">
        <span className="font-medium text-gray-800">Writing tip: </span>
        {word.writingTip}
      </p>
    </div>
  );
}

interface VocabularyPracticeProps {
  words: VocabularyWord[];
  initialProgress?: VocabularyProgress;
  onProgressChange?: (progress: VocabularyProgress) => void;
  onComplete: () => void;
}

export function VocabularyPractice({
  words,
  initialProgress,
  onProgressChange,
  onComplete,
}: VocabularyPracticeProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(
    initialProgress?.currentWordIndex ?? 0,
  );
  const [answersByWord, setAnswersByWord] = useState<
    Record<number, QuestionAnswerState[]>
  >(() => hydrateVocabularyAnswersByWord(initialProgress));
  const skipNextPersist = useRef(true);

  const currentWord = words[currentWordIndex];
  const questions = currentWord?.questions ?? [];
  const questionStates = answersByWord[currentWordIndex] ?? [];

  const initializeWordAnswers = useCallback(
    (wordIndex: number, wordQuestions: VocabularyQuestion[]) => {
      setAnswersByWord((prev) => {
        if (prev[wordIndex]) return prev;
        return {
          ...prev,
          [wordIndex]: wordQuestions.map(() => ({ checked: false })),
        };
      });
    },
    [],
  );

  useEffect(() => {
    if (currentWord?.questions?.length) {
      initializeWordAnswers(currentWordIndex, currentWord.questions);
    }
  }, [currentWord, currentWordIndex, initializeWordAnswers]);

  useEffect(() => {
    if (!onProgressChange) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    onProgressChange(
      serializeVocabularyProgress(currentWordIndex, answersByWord),
    );
  }, [answersByWord, currentWordIndex, onProgressChange]);

  const updateQuestionState = (
    questionIndex: number,
    updater: (state: QuestionAnswerState) => QuestionAnswerState,
  ) => {
    setAnswersByWord((prev) => {
      const existing =
        prev[currentWordIndex] ?? questions.map(() => ({ checked: false }));
      const next = [...existing];
      next[questionIndex] = updater(next[questionIndex] ?? { checked: false });
      return { ...prev, [currentWordIndex]: next };
    });
  };

  const handleSelectOption = (questionIndex: number, optionIndex: number) => {
    const question = questions[questionIndex];
    if (!question || question.type === "word_fit_select") return;

    updateQuestionState(questionIndex, () => ({
      selectedIndex: optionIndex,
      checked: true,
      isCorrect: optionIndex === question.correctAnswerIndex,
    }));
  };

  const handleToggleMultiSelect = (
    questionIndex: number,
    optionIndex: number,
  ) => {
    updateQuestionState(questionIndex, (state) => {
      const current = state.selectedIndexes ?? [];
      const next = current.includes(optionIndex)
        ? current.filter((index) => index !== optionIndex)
        : [...current, optionIndex];
      return { ...state, selectedIndexes: next };
    });
  };

  const handleCheckMultiSelect = (questionIndex: number) => {
    const question = questions[questionIndex];
    if (
      !question ||
      question.type !== "word_fit_select" ||
      !question.correctAnswerIndexes?.length
    ) {
      return;
    }

    updateQuestionState(questionIndex, (state) => ({
      ...state,
      checked: true,
      isCorrect: isMultiSelectAnswerCorrect(
        state.selectedIndexes ?? [],
        question.correctAnswerIndexes ?? [],
      ),
    }));
  };

  const allQuestionsChecked =
    questions.length > 0 &&
    questionStates.length === questions.length &&
    questionStates.every((state) => state.checked);

  const wordScore = useMemo(() => {
    const correct = questionStates.filter((state) => state.isCorrect).length;
    return { correct, total: questions.length };
  }, [questionStates, questions.length]);

  const sessionScore = useMemo(() => {
    let correct = 0;
    let total = 0;
    words.forEach((word, wordIndex) => {
      const states = answersByWord[wordIndex] ?? [];
      total += word.questions?.length ?? 0;
      correct += states.filter((state) => state.isCorrect).length;
    });
    return { correct, total };
  }, [answersByWord, words]);

  const isLastWord = currentWordIndex >= words.length - 1;

  const handleNextWord = () => {
    if (!allQuestionsChecked || isLastWord) return;
    setCurrentWordIndex((index) => index + 1);
  };

  const handlePreviousWord = () => {
    if (currentWordIndex <= 0) return;
    setCurrentWordIndex((index) => index - 1);
  };

  if (!currentWord) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Practice each word with definition, check-all-that-apply, and synonym
          questions. Listen to the pronunciation, then check your answers.
        </p>
        {sessionScore.total > 0 && (
          <Badge variant="outline">
            Session: {sessionScore.correct}/{sessionScore.total}
          </Badge>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-2xl font-semibold text-gray-900">
                {currentWord.word}
              </h3>
              <WordPronunciationButton word={currentWord.word} />
            </div>
            <p className="mt-1 text-sm text-gray-500">{currentWord.partOfSpeech}</p>
          </div>
          {allQuestionsChecked && (
            <Badge variant="outline">
              {wordScore.correct}/{wordScore.total} correct
            </Badge>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {questions.map((question, questionIndex) => (
          <VocabularyQuestionCard
            key={`${currentWord.word}-${question.type}-${questionIndex}`}
            question={question}
            questionNumber={questionIndex + 1}
            state={questionStates[questionIndex] ?? { checked: false }}
            onSelectOption={(optionIndex) =>
              handleSelectOption(questionIndex, optionIndex)
            }
            onToggleMultiSelect={(optionIndex) =>
              handleToggleMultiSelect(questionIndex, optionIndex)
            }
            onCheckMultiSelect={() => handleCheckMultiSelect(questionIndex)}
          />
        ))}

        {allQuestionsChecked && <VocabularyReferenceCard word={currentWord} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-500">
          Word {currentWordIndex + 1} of {words.length}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handlePreviousWord}
            disabled={currentWordIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          {!isLastWord ? (
            <Button
              type="button"
              size="sm"
              onClick={handleNextWord}
              disabled={!allQuestionsChecked}
            >
              Next word
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={onComplete}
              disabled={!allQuestionsChecked}
            >
              Complete session
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
