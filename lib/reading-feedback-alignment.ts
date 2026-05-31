import type { ReadingQuestion, ReadingQuestionResult } from "@/lib/types";

const STOP_WORDS = new Set([
  "about",
  "according",
  "based",
  "celpip",
  "following",
  "passage",
  "paragraph",
  "question",
  "reading",
  "section",
  "statement",
  "which",
  "would",
]);

export interface AiReadingFeedbackItem {
  index: number;
  feedback: string;
  celpipPart?: ReadingQuestionResult["celpipPart"];
  questionType?: ReadingQuestionResult["questionType"];
  targetClbBand?: number;
}

/** Normalize 1-based AI indices and prefer array order when length matches. */
export function alignAiReadingFeedback(
  items: AiReadingFeedbackItem[] | undefined,
  questionCount: number,
): AiReadingFeedbackItem[] | undefined {
  if (!items?.length || questionCount <= 0) return items;

  let aligned = [...items];
  const indices = aligned.map((item) => item.index);
  const minIndex = Math.min(...indices);
  const maxIndex = Math.max(...indices);

  if (minIndex === 1 && maxIndex >= questionCount) {
    aligned = aligned.map((item) => ({ ...item, index: item.index - 1 }));
  }

  if (aligned.length === questionCount) {
    const sorted = [...aligned].sort((a, b) => a.index - b.index);
    const positional = sorted.every((item, i) => item.index === i);
    if (!positional) {
      return sorted.map((item, i) => ({ ...item, index: i }));
    }
    return sorted;
  }

  return aligned;
}

export function isPollutedReadingFeedback(feedback: string): boolean {
  const trimmed = feedback.trim();
  if (!trimmed) return true;
  if (
    /\bthe correct answer is\s+['"]?(yes|no)['"]?/i.test(trimmed) ||
    /\bcorrect answer:\s*(yes|no)\b/i.test(trimmed)
  ) {
    return true;
  }
  return false;
}

export function feedbackMatchesQuestion(
  feedback: string,
  question: string,
): boolean {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4 && !STOP_WORDS.has(word));

  if (words.length === 0) return true;

  const feedbackLower = feedback.toLowerCase();
  const hits = words.filter((word) => feedbackLower.includes(word)).length;
  const required = words.length <= 2 ? 1 : Math.min(2, words.length);
  return hits >= required;
}

export function buildObjectiveReadingFeedback(
  isCorrect: boolean,
  question: ReadingQuestion,
  studentIndex?: number,
): string {
  if (isCorrect) return "Correct.";
  const correct = question.options[question.correctAnswerIndex];
  const student =
    studentIndex != null ? question.options[studentIndex] : undefined;
  if (student && student !== correct) {
    return `The correct answer is "${correct}". Your selection was "${student}".`;
  }
  return `The correct answer is "${correct}".`;
}

export function resolveReadingQuestionFeedback(
  aiFeedback: string | undefined,
  isCorrect: boolean,
  question: ReadingQuestion,
  studentIndex?: number,
): string {
  const raw = aiFeedback?.trim();
  if (!raw || isPollutedReadingFeedback(raw)) {
    return buildObjectiveReadingFeedback(isCorrect, question, studentIndex);
  }

  const polarityMismatch =
    (isCorrect && /^incorrect\b/i.test(raw)) ||
    (!isCorrect && /^correct\.?\s*$/i.test(raw));

  if (polarityMismatch || !feedbackMatchesQuestion(raw, question.question)) {
    return buildObjectiveReadingFeedback(isCorrect, question, studentIndex);
  }

  return raw;
}

export function pickAiFeedbackForQuestion(
  aiResults: AiReadingFeedbackItem[] | undefined,
  questionIndex: number,
  questionCount: number,
): AiReadingFeedbackItem | undefined {
  const aligned = alignAiReadingFeedback(aiResults, questionCount);
  if (!aligned?.length) return undefined;
  if (aligned.length === questionCount) {
    return aligned[questionIndex];
  }
  return aligned.find((item) => item.index === questionIndex);
}
