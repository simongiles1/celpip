import type { GeneratedContent, GradeResponse, GradedSession } from "@/lib/types";
import { getStoredConceptScore } from "@/lib/concept-submission";

export const CONCEPT_DRILL_COUNT = 8;

const LEGACY_PREFIX = "concept-lab-";
const SET_SUFFIX = "-set-";

export function conceptSetEventId(conceptId: string, setNumber: number): string {
  return `${LEGACY_PREFIX}${conceptId}${SET_SUFFIX}${setNumber}`;
}

export function legacyConceptEventId(conceptId: string): string {
  return `${LEGACY_PREFIX}${conceptId}`;
}

export function parseConceptSetEventId(eventId: string): {
  conceptId: string;
  setNumber: number;
} | null {
  const setMatch = eventId.match(/^concept-lab-(.+)-set-(\d+)$/);
  if (setMatch) {
    return {
      conceptId: setMatch[1],
      setNumber: Number(setMatch[2]),
    };
  }

  const legacyMatch = eventId.match(/^concept-lab-(.+)$/);
  if (legacyMatch) {
    return { conceptId: legacyMatch[1], setNumber: 1 };
  }

  return null;
}

export function isConceptLabEventId(eventId: string): boolean {
  return eventId.startsWith(LEGACY_PREFIX);
}

export function normalizeGeneratedSet(item: GeneratedContent): GeneratedContent {
  if (item.setNumber != null) return item;

  const parsed = parseConceptSetEventId(item.eventId);
  if (parsed) {
    return { ...item, setNumber: parsed.setNumber, conceptId: item.conceptId ?? parsed.conceptId };
  }

  return item;
}

export function getGeneratedSetsForConcept(
  generated: GeneratedContent[],
  conceptId: string,
): GeneratedContent[] {
  return generated
    .map(normalizeGeneratedSet)
    .filter(
      (item) =>
        item.conceptId === conceptId ||
        parseConceptSetEventId(item.eventId)?.conceptId === conceptId,
    )
    .sort((a, b) => (a.setNumber ?? 1) - (b.setNumber ?? 1));
}

export function getNextSetNumber(sets: GeneratedContent[]): number {
  if (sets.length === 0) return 1;
  return Math.max(...sets.map((s) => s.setNumber ?? 1)) + 1;
}

export function getConceptSetScore(
  gradeResult: GradeResponse | null | undefined,
  drillCount: number = CONCEPT_DRILL_COUNT,
): { correct: number; total: number } | null {
  if (!gradeResult?.drillResults?.length && !gradeResult?.writingResult) {
    return null;
  }

  const drillCorrect =
    gradeResult.drillResults?.filter((result) => result.isCorrect).length ?? 0;
  const total = gradeResult.drillResults?.length ?? drillCount;

  return { correct: drillCorrect, total };
}

export function formatQuestionSetLabel(
  setNumber: number,
  score: { correct: number; total: number } | null,
): string {
  const base = `Question set ${setNumber}`;
  return score ? `${base} (${score.correct}/${score.total})` : base;
}

export function getStoredSetScore(
  graded: GradedSession[],
  eventId: string,
): { correct: number; total: number } | null {
  const session = graded.find((item) => item.eventId === eventId);
  if (!session || typeof session.studentSubmission !== "string") return null;
  return getStoredConceptScore(session.studentSubmission);
}
