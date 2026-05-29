import { getReadingPassageScore } from "@/lib/reading-passage-sets";
import { buildReadingResults, getReadingAnswers, isReadingSubmissionEnvelope } from "@/lib/reading-submission";
import type {
  GeneratedContent,
  GradedSession,
  ReadingQuestion,
  ReadingSubmissionEnvelope,
} from "@/lib/types";

/** Set on generated content after legacy index repair has been applied. */
export const READING_ANSWER_INDEX_REPAIR_VERSION = 1;

export function getReadingQuestionsForDisplay(
  content: Pick<GeneratedContent, "examPrompt" | "readingQuestions" | "readingAnswerIndexRepairVersion">,
  studentAnswers?: Record<string, number>,
): ReadingQuestion[] {
  if (!content.readingQuestions?.length) return [];
  if (
    content.readingAnswerIndexRepairVersion ===
    READING_ANSWER_INDEX_REPAIR_VERSION
  ) {
    return content.readingQuestions;
  }
  return repairLegacyReadingAnswerIndices(content.readingQuestions, {
    examPrompt: content.examPrompt,
    studentAnswers,
  });
}


function stripOptionLabel(option: string): string {
  return option.replace(/^[A-D]\.?\s*/i, "").trim();
}

function isSectionStyleQuestion(question: ReadingQuestion): boolean {
  return question.options.every((option) =>
    /^[A-D]\.?\s*Section\s+[A-D]\b/i.test(option.trim()),
  );
}

function parsePassageSections(examPrompt: string): Map<string, string> {
  const sections = new Map<string, string>();
  const pattern =
    /(?:^|\n)\s*(?:\*\*)?([A-D])\.\s+([\s\S]*?)(?=(?:^|\n)\s*(?:\*\*)?[A-D]\.\s+|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(examPrompt)) !== null) {
    sections.set(match[1].toUpperCase(), match[2].trim().toLowerCase());
  }
  return sections;
}

function scoreQuestionAgainstSection(
  question: string,
  sectionBody: string,
): number {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4);
  if (words.length === 0) return 0;
  let hits = 0;
  for (const word of words) {
    if (sectionBody.includes(word)) hits++;
  }
  return hits;
}

function inferSectionAnswerIndex(
  question: ReadingQuestion,
  examPrompt: string,
): number | null {
  if (!isSectionStyleQuestion(question)) return null;
  const sections = parsePassageSections(examPrompt);
  if (sections.size === 0) return null;

  let bestIndex: number | null = null;
  let bestScore = 0;
  for (let i = 0; i < question.options.length; i++) {
    const label = stripOptionLabel(question.options[i]);
    const sectionLetter = label.match(/Section\s+([A-D])/i)?.[1]?.toUpperCase();
    if (!sectionLetter) continue;
    const body = sections.get(sectionLetter);
    if (!body) continue;
    const score = scoreQuestionAgainstSection(question.question, body);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestScore > 0 ? bestIndex : null;
}

function inferPassageOptionIndex(
  question: ReadingQuestion,
  examPrompt: string,
): number | null {
  const passageLower = examPrompt.toLowerCase();
  let bestIndex: number | null = null;
  let bestScore = 0;

  for (let i = 0; i < question.options.length; i++) {
    const label = stripOptionLabel(question.options[i]).toLowerCase();
    if (!label) continue;

    const quoted = label.match(/"([^"]+)"/)?.[1]?.toLowerCase();
    const terms = (quoted ?? label)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3);

    const matchedTerms = terms.filter((term) => passageLower.includes(term));
    const score =
      matchedTerms.length * 10 +
      (quoted && passageLower.includes(quoted) ? quoted.length : 0);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore > 0 ? bestIndex : null;
}

/** Detect batches corrupted by the old 0-based → 1-based subtraction bug. */
export function detectLegacyReadingIndexCorruption(
  questions: ReadingQuestion[],
  studentAnswers?: Record<string, number>,
): boolean {
  if (questions.length === 0) return false;

  if (studentAnswers) {
    let offByOneSignals = 0;
    for (let i = 0; i < questions.length; i++) {
      const stored = questions[i].correctAnswerIndex;
      const student = studentAnswers[String(i)];
      if (student == null) continue;
      if (student !== stored && student === stored + 1 && student <= 3) {
        offByOneSignals++;
      }
    }
    if (offByOneSignals >= 1) return true;
  }

  const indices = questions.map((q) => q.correctAnswerIndex);
  const zeroCount = indices.filter((index) => index === 0).length;
  const hasMidIndices = indices.some((index) => index >= 1 && index <= 2);
  const lacksThree = !indices.some((index) => index === 3);
  return zeroCount >= 2 && hasMidIndices && lacksThree;
}

export function repairLegacyReadingAnswerIndices(
  questions: ReadingQuestion[],
  options?: {
    examPrompt?: string;
    studentAnswers?: Record<string, number>;
  },
): ReadingQuestion[] {
  if (!detectLegacyReadingIndexCorruption(questions, options?.studentAnswers)) {
    return questions;
  }

  return questions.map((question, index) => {
    let repaired = question.correctAnswerIndex;

    if (repaired >= 1) {
      repaired = Math.min(3, repaired + 1);
    }

    if (repaired === 0) {
      const student = options?.studentAnswers?.[String(index)];
      if (student === 1) {
        repaired = 1;
      } else if (options?.examPrompt) {
        const inferred =
          inferSectionAnswerIndex(question, options.examPrompt) ??
          inferPassageOptionIndex(question, options.examPrompt);
        if (inferred != null) {
          repaired = inferred;
        }
      }
    }

    if (repaired === question.correctAnswerIndex) {
      return question;
    }

    return { ...question, correctAnswerIndex: repaired };
  });
}

function recomputeReadingSubmission(
  submission: ReadingSubmissionEnvelope,
  questions: ReadingQuestion[],
): ReadingSubmissionEnvelope {
  const answers = submission.answers;
  const readingResults = buildReadingResults(answers, questions);
  const score = getReadingPassageScore(answers, questions);
  const pct = score.total > 0 ? score.correct / score.total : 0;
  const estimatedBand = Math.max(1, Math.min(12, Math.round(pct * 12)));

  return {
    ...submission,
    gradeMetadata: {
      ...submission.gradeMetadata,
      score,
      readingResults,
      estimatedBand,
    },
  };
}

function findGeneratedForGradedEvent(
  generated: GeneratedContent[],
  eventId: string,
): GeneratedContent | undefined {
  return generated.find((item) => item.eventId === eventId);
}

export function migrateReadingAnswerIndices(data: {
  generated: GeneratedContent[];
  graded: GradedSession[];
}): {
  generated: GeneratedContent[];
  graded: GradedSession[];
  changed: boolean;
} {
  let changed = false;
  const generatedById = new Map(
    data.generated.map((item) => [item.eventId, { ...item }]),
  );

  for (const [eventId, item] of generatedById) {
    if (
      item.readingAnswerIndexRepairVersion === READING_ANSWER_INDEX_REPAIR_VERSION ||
      !item.readingQuestions?.length
    ) {
      continue;
    }

    const graded = data.graded.find(
      (session) =>
        session.eventId === eventId && session.focusSubTest === "Reading",
    );
    const studentAnswers =
      graded && typeof graded.studentSubmission === "object"
        ? getReadingAnswers(graded.studentSubmission)
        : item.readingAnswers;

    const repaired = repairLegacyReadingAnswerIndices(item.readingQuestions, {
      examPrompt: item.examPrompt,
      studentAnswers,
    });

    const questionsChanged = repaired.some(
      (question, index) =>
        question.correctAnswerIndex !== item.readingQuestions![index].correctAnswerIndex,
    );

    if (!questionsChanged) {
      generatedById.set(eventId, {
        ...item,
        readingAnswerIndexRepairVersion: READING_ANSWER_INDEX_REPAIR_VERSION,
      });
      changed = true;
      continue;
    }

    generatedById.set(eventId, {
      ...item,
      readingQuestions: repaired,
      readingAnswerIndexRepairVersion: READING_ANSWER_INDEX_REPAIR_VERSION,
    });
    changed = true;
  }

  const generated = Array.from(generatedById.values());
  const graded = data.graded.map((session) => {
    if (session.focusSubTest !== "Reading") return session;
    if (typeof session.studentSubmission !== "object") return session;
    if (!isReadingSubmissionEnvelope(session.studentSubmission)) return session;

    const source = findGeneratedForGradedEvent(generated, session.eventId);
    if (!source?.readingQuestions?.length) return session;

    const updatedSubmission = recomputeReadingSubmission(
      session.studentSubmission,
      source.readingQuestions,
    );

    const scoreChanged =
      updatedSubmission.gradeMetadata?.score.correct !==
        session.studentSubmission.gradeMetadata?.score.correct ||
      updatedSubmission.gradeMetadata?.estimatedBand !==
        session.studentSubmission.gradeMetadata?.estimatedBand;

    if (!scoreChanged) return session;

    changed = true;
    return {
      ...session,
      estimatedBand:
        updatedSubmission.gradeMetadata?.estimatedBand ?? session.estimatedBand,
      studentSubmission: updatedSubmission,
    };
  });

  return { generated, graded, changed };
}
