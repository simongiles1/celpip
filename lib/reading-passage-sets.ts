import type { GeneratedContent, GradedSession, ReadingQuestion } from "@/lib/types";
import { getReadingAnswers } from "@/lib/reading-submission";

const SET_SUFFIX = "-rset-";

export function readingPassageEventId(
  baseEventId: string,
  setNumber: number,
): string {
  if (setNumber <= 1) return baseEventId;
  return `${baseEventId}${SET_SUFFIX}${setNumber}`;
}

export function parseReadingPassageEventId(eventId: string): {
  baseEventId: string;
  setNumber: number;
} {
  const setMatch = eventId.match(/^(.+)-rset-(\d+)$/);
  if (setMatch) {
    return {
      baseEventId: setMatch[1],
      setNumber: Number(setMatch[2]),
    };
  }
  return { baseEventId: eventId, setNumber: 1 };
}

export function normalizeReadingPassageSet(
  item: GeneratedContent,
  baseEventId: string,
): GeneratedContent {
  if (item.setNumber != null) return item;

  const parsed = parseReadingPassageEventId(item.eventId);
  if (parsed.baseEventId === baseEventId || item.eventId === baseEventId) {
    return {
      ...item,
      setNumber: parsed.setNumber,
    };
  }

  return item;
}

export function getGeneratedPassagesForEvent(
  generated: GeneratedContent[],
  baseEventId: string,
): GeneratedContent[] {
  return generated
    .filter((item) => {
      const parsed = parseReadingPassageEventId(item.eventId);
      return parsed.baseEventId === baseEventId;
    })
    .map((item) => normalizeReadingPassageSet(item, baseEventId))
    .sort((a, b) => (a.setNumber ?? 1) - (b.setNumber ?? 1));
}

export function getNextPassageSetNumber(sets: GeneratedContent[]): number {
  if (sets.length === 0) return 1;
  return Math.max(...sets.map((s) => s.setNumber ?? 1)) + 1;
}

export function getBasePassageSet(
  sets: GeneratedContent[],
): GeneratedContent | undefined {
  return sets.find((s) => (s.setNumber ?? 1) === 1) ?? sets[0];
}

export function formatPassageLabel(
  setNumber: number,
  score: { correct: number; total: number } | null,
): string {
  const base = `Passage ${setNumber}`;
  return score ? `${base} (${score.correct}/${score.total})` : base;
}

export function getReadingPassageScore(
  answers: Record<string, number>,
  questions: ReadingQuestion[],
): { correct: number; total: number } {
  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[String(i)] === q.correctAnswerIndex) correct++;
  });
  return { correct, total: questions.length };
}

export function getStoredReadingPassageScore(
  graded: GradedSession[],
  passageEventId: string,
  questions: ReadingQuestion[],
): { correct: number; total: number } | null {
  const session = graded.find((item) => item.eventId === passageEventId);
  if (!session || typeof session.studentSubmission !== "object") return null;
  const answers = getReadingAnswers(session.studentSubmission);
  if (!questions.length) return null;
  return getReadingPassageScore(answers, questions);
}

export function hasReadingPassageAnswers(
  answers: Record<string, number> | undefined,
): boolean {
  return Boolean(answers && Object.keys(answers).length > 0);
}
