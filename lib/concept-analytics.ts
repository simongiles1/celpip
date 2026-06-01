import {
  getStoredConceptScore,
  parseConceptSubmission,
  type ParsedConceptSubmission,
} from "@/lib/concept-submission";
import {
  isConceptLabEventId,
  parseConceptSetEventId,
} from "@/lib/concept-question-sets";
import { CONCEPT_UNIT_PREFIX } from "@/lib/concept-units";
import type { ConceptGradeMetadata, GradedSession } from "@/lib/types";

export interface ConceptPracticeAttempt {
  eventId: string;
  conceptId: string;
  setNumber: number;
  gradedAt: string;
  score: { correct: number; total: number } | null;
  totalTimeSeconds: number | null;
  avgTimePerQuestionSeconds: number | null;
  questionTimings: Record<string, number>;
}

export function formatConceptDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  if (clamped < 60) return `${clamped}s`;
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function metadataFromSubmission(
  submission: string,
): ConceptGradeMetadata | null {
  const { gradeMetadata } = parseConceptSubmission(submission);
  return gradeMetadata as ConceptGradeMetadata | null;
}

export function getQuestionTimingsFromMetadata(
  metadata: ParsedConceptSubmission["gradeMetadata"],
): Record<string, number> {
  const stored = (metadata as ConceptGradeMetadata | null)?.questionTimings;
  if (!stored || typeof stored !== "object") return {};

  return Object.fromEntries(
    Object.entries(stored).filter(
      ([, value]) => typeof value === "number" && Number.isFinite(value),
    ),
  );
}

export function getSessionDurationSeconds(
  metadata: ConceptGradeMetadata | null,
  questionTimings: Record<string, number>,
): number | null {
  if (
    metadata?.sessionDurationSeconds != null &&
    Number.isFinite(metadata.sessionDurationSeconds)
  ) {
    return Math.max(0, Math.round(metadata.sessionDurationSeconds));
  }

  const values = Object.values(questionTimings);
  if (values.length === 0) return null;

  const total = values.reduce((sum, value) => sum + value, 0);
  return total > 0 ? Math.round(total) : null;
}

function getConceptIdFromSession(session: GradedSession): string | null {
  const fromLabEvent = parseConceptSetEventId(session.eventId)?.conceptId;
  if (fromLabEvent) return fromLabEvent;

  if (session.curriculumUnitId.startsWith(CONCEPT_UNIT_PREFIX)) {
    return session.curriculumUnitId.slice(CONCEPT_UNIT_PREFIX.length);
  }

  return null;
}

function getSetNumberFromSession(session: GradedSession): number {
  return parseConceptSetEventId(session.eventId)?.setNumber ?? 1;
}

export function getConceptPracticeHistory(
  graded: GradedSession[],
  conceptId: string,
): ConceptPracticeAttempt[] {
  return graded
    .filter((session) => {
      if (session.focusSubTest !== "Concept") return false;
      if (typeof session.studentSubmission !== "string") return false;
      return getConceptIdFromSession(session) === conceptId;
    })
    .map((session) => {
      const submission = session.studentSubmission as string;
      const metadata = metadataFromSubmission(submission);
      const questionTimings = getQuestionTimingsFromMetadata(metadata);
      const score =
        metadata?.score ?? getStoredConceptScore(submission);
      const totalTimeSeconds = getSessionDurationSeconds(
        metadata,
        questionTimings,
      );
      const timingValues = Object.values(questionTimings);
      const avgTimePerQuestionSeconds =
        timingValues.length > 0 && totalTimeSeconds != null
          ? Math.round(totalTimeSeconds / timingValues.length)
          : null;

      return {
        eventId: session.eventId,
        conceptId,
        setNumber: getSetNumberFromSession(session),
        gradedAt: session.gradedAt,
        score,
        totalTimeSeconds,
        avgTimePerQuestionSeconds,
        questionTimings,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.gradedAt).getTime() - new Date(a.gradedAt).getTime(),
    );
}

export interface ConceptPracticeChartPoint {
  attemptLabel: string;
  gradedAt: string;
  setNumber: number;
  scorePct: number | null;
  avgTimePerQuestionSeconds: number | null;
  scoreLabel: string | null;
  avgTimeLabel: string | null;
}

export function getConceptPracticeChartData(
  history: ConceptPracticeAttempt[],
): ConceptPracticeChartPoint[] {
  return history
    .slice()
    .reverse()
    .map((attempt) => ({
      attemptLabel: `Set ${attempt.setNumber}`,
      gradedAt: attempt.gradedAt,
      setNumber: attempt.setNumber,
      scorePct: attempt.score
        ? Math.round((attempt.score.correct / attempt.score.total) * 100)
        : null,
      avgTimePerQuestionSeconds: attempt.avgTimePerQuestionSeconds,
      scoreLabel: attempt.score
        ? `${attempt.score.correct}/${attempt.score.total}`
        : null,
      avgTimeLabel:
        attempt.avgTimePerQuestionSeconds != null
          ? formatConceptDuration(attempt.avgTimePerQuestionSeconds)
          : null,
    }));
}

export function getConceptLabGradedSessions(
  graded: GradedSession[],
): GradedSession[] {
  return graded.filter(
    (session) =>
      session.focusSubTest === "Concept" &&
      isConceptLabEventId(session.eventId) &&
      typeof session.studentSubmission === "string",
  );
}
