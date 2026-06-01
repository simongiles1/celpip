import type { ConceptDrillResult, ConceptGradeMetadata, GradeResponse } from "@/lib/types";
import { getConceptSetScore } from "@/lib/concept-question-sets";

const METADATA_MARKER = "\n\n---CONCEPT GRADE---\n";

export interface ParsedConceptSubmission {
  drillAnswers: string[];
  writingAnswer: string;
  gradeMetadata: ConceptGradeMetadata | null;
}

function mergeConceptDrillTimings(
  drillResults: ConceptDrillResult[] | undefined,
  questionTimings?: Record<string, number>,
): ConceptDrillResult[] | undefined {
  if (!drillResults?.length) return drillResults;
  if (!questionTimings || Object.keys(questionTimings).length === 0) {
    return drillResults;
  }

  return drillResults.map((result) => {
    const timeSpentSeconds = questionTimings[String(result.index)];
    if (timeSpentSeconds == null || !Number.isFinite(timeSpentSeconds)) {
      return result;
    }
    return {
      ...result,
      timeSpentSeconds: Math.max(0, Math.round(timeSpentSeconds)),
    };
  });
}

function sumQuestionTimings(questionTimings?: Record<string, number>): number | undefined {
  if (!questionTimings) return undefined;
  const values = Object.values(questionTimings).filter((value) =>
    Number.isFinite(value),
  );
  if (values.length === 0) return undefined;
  return Math.round(values.reduce((sum, value) => sum + value, 0));
}

export function parseConceptSubmission(submission: string): ParsedConceptSubmission {
  const metadataIndex = submission.indexOf(METADATA_MARKER);
  const workingSubmission =
    metadataIndex >= 0 ? submission.slice(0, metadataIndex) : submission;

  const writingMatch = workingSubmission.match(/MINI WRITING:\n([\s\S]*)$/);
  const writingAnswer = writingMatch?.[1]?.trim() ?? "";

  const drillBlock =
    workingSubmission.match(/DRILL RESPONSES:\n([\s\S]*?)(?:\n\nMINI WRITING:|$)/)?.[1] ??
    "";
  const drillAnswers = [...drillBlock.matchAll(/^A: (.*)$/gm)].map((m) => m[1]);

  let gradeMetadata: ConceptGradeMetadata | null = null;
  if (metadataIndex >= 0) {
    const raw = submission.slice(metadataIndex + METADATA_MARKER.length).trim();
    try {
      const parsed = JSON.parse(raw) as ConceptGradeMetadata;
      if (parsed && typeof parsed === "object") {
        gradeMetadata = parsed;
      }
    } catch {
      gradeMetadata = null;
    }
  }

  return { drillAnswers, writingAnswer, gradeMetadata };
}

export function appendConceptGradeMetadata(
  submission: string,
  gradeResult: GradeResponse,
  drillCount: number,
  options?: {
    questionTimings?: Record<string, number>;
    sessionDurationSeconds?: number;
  },
): string {
  const score = getConceptSetScore(gradeResult, drillCount);
  const drillResults = mergeConceptDrillTimings(
    gradeResult.drillResults,
    options?.questionTimings,
  );
  const sessionDurationSeconds =
    options?.sessionDurationSeconds != null &&
    Number.isFinite(options.sessionDurationSeconds)
      ? Math.max(0, Math.round(options.sessionDurationSeconds))
      : sumQuestionTimings(options?.questionTimings);
  const metadata: ConceptGradeMetadata = {
    score,
    drillResults,
    writingResult: gradeResult.writingResult,
    estimatedBand: gradeResult.estimatedBand,
    ...(options?.questionTimings &&
    Object.keys(options.questionTimings).length > 0
      ? { questionTimings: options.questionTimings }
      : {}),
    ...(sessionDurationSeconds != null
      ? { sessionDurationSeconds }
      : {}),
  };
  return `${submission}${METADATA_MARKER}${JSON.stringify(metadata)}`;
}

export function getStoredConceptScore(
  submission: string,
): { correct: number; total: number } | null {
  const { gradeMetadata } = parseConceptSubmission(submission);
  return gradeMetadata?.score ?? null;
}

export function getStoredConceptTimings(
  submission: string,
): Record<string, number> {
  const { gradeMetadata } = parseConceptSubmission(submission);
  if (!gradeMetadata?.questionTimings) return {};
  return Object.fromEntries(
    Object.entries(gradeMetadata.questionTimings).filter(
      ([, value]) => typeof value === "number" && Number.isFinite(value),
    ),
  );
}
