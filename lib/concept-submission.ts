import type { GradeResponse } from "@/lib/types";
import { getConceptSetScore } from "@/lib/concept-question-sets";

const METADATA_MARKER = "\n\n---CONCEPT GRADE---\n";

export interface ParsedConceptSubmission {
  drillAnswers: string[];
  writingAnswer: string;
  gradeMetadata: Pick<
    GradeResponse,
    "drillResults" | "writingResult" | "estimatedBand"
  > | null;
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

  let gradeMetadata: ParsedConceptSubmission["gradeMetadata"] = null;
  if (metadataIndex >= 0) {
    const raw = submission.slice(metadataIndex + METADATA_MARKER.length).trim();
    try {
      const parsed = JSON.parse(raw) as ParsedConceptSubmission["gradeMetadata"];
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
): string {
  const score = getConceptSetScore(gradeResult, drillCount);
  const metadata = {
    score,
    drillResults: gradeResult.drillResults,
    writingResult: gradeResult.writingResult,
    estimatedBand: gradeResult.estimatedBand,
  };
  return `${submission}${METADATA_MARKER}${JSON.stringify(metadata)}`;
}

export function getStoredConceptScore(
  submission: string,
): { correct: number; total: number } | null {
  const { gradeMetadata } = parseConceptSubmission(submission);
  const score = (gradeMetadata as { score?: { correct: number; total: number } | null })
    ?.score;
  return score ?? null;
}
