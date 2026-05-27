import { getReadingPassageScore } from "@/lib/reading-passage-sets";
import type {
  GradeResponse,
  ReadingGradeMetadata,
  ReadingQuestion,
  ReadingQuestionResult,
  ReadingSubmissionEnvelope,
} from "@/lib/types";

export type { ReadingGradeMetadata, ReadingSubmissionEnvelope };

export function isReadingSubmissionEnvelope(
  submission: unknown,
): submission is ReadingSubmissionEnvelope {
  return (
    typeof submission === "object" &&
    submission !== null &&
    "answers" in submission &&
    typeof (submission as ReadingSubmissionEnvelope).answers === "object"
  );
}

export function getReadingAnswers(
  submission: string | Record<string, number> | ReadingSubmissionEnvelope,
): Record<string, number> {
  if (isReadingSubmissionEnvelope(submission)) {
    return submission.answers;
  }
  if (typeof submission === "object" && submission !== null) {
    return submission as Record<string, number>;
  }
  return {};
}

export function getReadingGradeMetadata(
  submission: string | Record<string, number> | ReadingSubmissionEnvelope,
): ReadingGradeMetadata | null {
  if (isReadingSubmissionEnvelope(submission)) {
    return submission.gradeMetadata ?? null;
  }
  return null;
}

export function buildReadingResults(
  answers: Record<string, number>,
  questions: ReadingQuestion[],
  aiResults?: ReadingQuestionResult[],
  questionTimings?: Record<string, number>,
): ReadingQuestionResult[] {
  const aiByIndex = new Map(aiResults?.map((result) => [result.index, result]));

  return questions.map((question, index) => {
    const studentIndex = answers[String(index)];
    const isCorrect = studentIndex === question.correctAnswerIndex;
    const aiResult = aiByIndex.get(index);
    const timeSpentSeconds = questionTimings?.[String(index)];

    return {
      index,
      isCorrect,
      studentAnswer:
        studentIndex != null
          ? question.options[studentIndex]
          : "(no answer selected)",
      correctAnswer: question.options[question.correctAnswerIndex],
      feedback:
        aiResult?.feedback ??
        (isCorrect
          ? "Correct."
          : `The correct answer is "${question.options[question.correctAnswerIndex]}".`),
      celpipPart: aiResult?.celpipPart ?? question.celpipPart,
      questionType: aiResult?.questionType ?? question.questionType,
      targetClbBand: aiResult?.targetClbBand ?? question.targetClbBand,
      ...(timeSpentSeconds != null && Number.isFinite(timeSpentSeconds)
        ? { timeSpentSeconds: Math.max(0, Math.round(timeSpentSeconds)) }
        : {}),
    };
  });
}

export function buildReadingSubmissionEnvelope(
  answers: Record<string, number>,
  questions: ReadingQuestion[],
  gradeResult: GradeResponse,
  options?: {
    questionTimings?: Record<string, number>;
    passageCelpipPart?: ReadingQuestionResult["celpipPart"];
    passageTargetClbBand?: number;
    passageDurationSeconds?: number;
  },
): ReadingSubmissionEnvelope {
  const score = getReadingPassageScore(answers, questions);
  const readingResults = buildReadingResults(
    answers,
    questions,
    gradeResult.readingResults,
    options?.questionTimings,
  );

  return {
    answers,
    questionTimings: options?.questionTimings,
    gradeMetadata: {
      score,
      readingResults,
      estimatedBand: gradeResult.estimatedBand,
      passageCelpipPart: options?.passageCelpipPart,
      passageTargetClbBand: options?.passageTargetClbBand,
      passageDurationSeconds: options?.passageDurationSeconds,
    },
  };
}

export function gradeResponseFromReadingMetadata(
  metadata: ReadingGradeMetadata,
  session: {
    overallFeedback: string;
    positives: string[];
    constructiveCriticism: string[];
    grammarCorrections: GradeResponse["grammarCorrections"];
  },
): GradeResponse {
  return {
    estimatedBand: metadata.estimatedBand,
    overallFeedback: session.overallFeedback,
    positives: session.positives,
    constructiveCriticism: session.constructiveCriticism,
    grammarCorrections: session.grammarCorrections,
    readingResults: metadata.readingResults,
  };
}
