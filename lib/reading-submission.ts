import { getReadingPassageScore } from "@/lib/reading-passage-sets";
import {
  pickAiFeedbackForQuestion,
  resolveReadingQuestionFeedback,
} from "@/lib/reading-feedback-alignment";
import { getReadingQuestionsForGrading } from "@/lib/repair-reading-answer-indices";
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

export function getStoredReadingQuestions(
  submission: string | Record<string, number> | ReadingSubmissionEnvelope,
): ReadingQuestion[] {
  if (!isReadingSubmissionEnvelope(submission)) return [];
  return submission.readingQuestions ?? [];
}

export function getReadingResultsForSession(
  session: {
    focusSubTest: string;
    studentSubmission:
      | string
      | Record<string, number>
      | ReadingSubmissionEnvelope;
  },
): ReadingQuestionResult[] {
  if (session.focusSubTest !== "Reading") return [];
  if (!isReadingSubmissionEnvelope(session.studentSubmission)) return [];

  const submission = session.studentSubmission;
  const answers = submission.answers;
  const storedQuestions = submission.readingQuestions;

  if (storedQuestions?.length) {
    const questions = getReadingQuestionsForGrading(storedQuestions, {
      examPrompt: submission.examPrompt,
      studentAnswers: answers,
    });
    return buildReadingResults(
      answers,
      questions,
      submission.gradeMetadata?.readingResults,
      submission.questionTimings,
    );
  }

  return submission.gradeMetadata?.readingResults ?? [];
}

export function getReadingScoreForSession(session: {
  focusSubTest: string;
  studentSubmission:
    | string
    | Record<string, number>
    | ReadingSubmissionEnvelope;
}): { correct: number; total: number } {
  if (session.focusSubTest !== "Reading") return { correct: 0, total: 0 };
  if (!isReadingSubmissionEnvelope(session.studentSubmission)) {
    return { correct: 0, total: 0 };
  }

  const submission = session.studentSubmission;
  const answers = submission.answers;
  const storedQuestions = submission.readingQuestions;

  if (storedQuestions?.length) {
    const questions = getReadingQuestionsForGrading(storedQuestions, {
      examPrompt: submission.examPrompt,
      studentAnswers: answers,
    });
    return getReadingPassageScore(answers, questions);
  }

  return (
    submission.gradeMetadata?.score ?? {
      correct: 0,
      total: submission.gradeMetadata?.readingResults?.length ?? 0,
    }
  );
}

export function buildReadingResults(
  answers: Record<string, number>,
  questions: ReadingQuestion[],
  aiResults?: ReadingQuestionResult[],
  questionTimings?: Record<string, number>,
): ReadingQuestionResult[] {
  const questionCount = questions.length;

  return questions.map((question, index) => {
    const studentIndex = answers[String(index)];
    const isCorrect = studentIndex === question.correctAnswerIndex;
    const aiResult = pickAiFeedbackForQuestion(aiResults, index, questionCount);
    const timeSpentSeconds = questionTimings?.[String(index)];

    return {
      index,
      isCorrect,
      studentAnswer:
        studentIndex != null
          ? question.options[studentIndex]
          : "(no answer selected)",
      correctAnswer: question.options[question.correctAnswerIndex],
      feedback: resolveReadingQuestionFeedback(
        aiResult?.feedback,
        isCorrect,
        question,
        studentIndex,
      ),
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
