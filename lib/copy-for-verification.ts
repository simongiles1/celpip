import type { GradeResponse, ReadingQuestion, ReadingQuestionResult } from "@/lib/types";

function optionLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

const READING_CONTEXT_INTRO = `You are helping me verify a CELPIP (Canadian English Language Proficiency Index Program) reading practice exercise.

This content was generated and graded by my local CELPIP study app (not the official CELPIP test). I am copying it here so you can independently check whether my answers were actually wrong, or whether the app may have graded something incorrectly.

Please:
1. Read the passage carefully.
2. For each question, determine the best answer from the options.
3. Compare your answers to both my selections and the app's marked correct answers.
4. Tell me whether the app's grading looks accurate for each question.`;

const WRITING_CONTEXT_INTRO = `You are helping me verify a CELPIP writing practice exercise.

This content was generated and graded by my local CELPIP study app (not the official CELPIP test). I am copying it here so you can independently assess whether the app's CLB band estimate and feedback seem reasonable.

Please:
1. Read the writing prompt and my response.
2. Evaluate my response against typical CELPIP writing criteria (task fulfillment, coherence, vocabulary, grammar).
3. Compare your assessment to the app's estimated CLB band and feedback.
4. Tell me whether the app's grading looks accurate.`;

function formatOptionList(options: string[]): string {
  return options.map((option, index) => `${optionLabel(index)}) ${option}`).join("\n");
}

/** Temporary dev helper: passage + questions only (no answers) for external AI. */
const READING_PRACTICE_COPY_INTRO = `Please read this CELPIP-style reading practice passage and answer each multiple-choice question.

For each question, reply with:
- Question number
- Your chosen letter (A, B, C, or D)
- One brief sentence explaining your choice`;

export interface ReadingPracticeCopyInput {
  testLabel: string;
  examPrompt: string;
  questions: ReadingQuestion[];
}

export function formatReadingPracticeCopy(
  input: ReadingPracticeCopyInput,
): string {
  const sections: string[] = [
    READING_PRACTICE_COPY_INTRO,
    "",
    "## Test info",
    `Type: ${input.testLabel}`,
    "",
    "## Passage",
    input.examPrompt.trim(),
    "",
    "## Questions",
  ];

  input.questions.forEach((question, questionIndex) => {
    sections.push(
      "",
      `### Question ${questionIndex + 1}`,
      question.question,
      "",
      formatOptionList(question.options),
    );
  });

  return sections.join("\n");
}

export interface ReadingVerificationCopyInput {
  testLabel: string;
  examPrompt: string;
  questions: ReadingQuestion[];
  answers: Record<string, number>;
  readingResults?: ReadingQuestionResult[];
  estimatedBand?: number;
  score?: { correct: number; total: number };
}

export function formatReadingVerificationCopy(
  input: ReadingVerificationCopyInput,
): string {
  const sections: string[] = [READING_CONTEXT_INTRO, "", "## Test info", `Type: ${input.testLabel}`];

  if (input.score) {
    sections.push(`App score: ${input.score.correct}/${input.score.total} correct`);
  }
  if (input.estimatedBand != null) {
    sections.push(`App estimated CLB band: ${input.estimatedBand}`);
  }

  sections.push("", "## Passage", input.examPrompt.trim(), "", "## Questions");

  const resultsByIndex = new Map(
    input.readingResults?.map((result) => [result.index, result]) ?? [],
  );

  input.questions.forEach((question, questionIndex) => {
    const result = resultsByIndex.get(questionIndex);
    const selectedIndex = input.answers[String(questionIndex)];
    const selectedLabel =
      selectedIndex != null ? optionLabel(selectedIndex) : "(none)";
    const selectedText =
      selectedIndex != null
        ? question.options[selectedIndex]
        : "(no answer selected)";
    const correctText = question.options[question.correctAnswerIndex];
    const correctLabel = optionLabel(question.correctAnswerIndex);

    sections.push(
      "",
      `### Question ${questionIndex + 1}`,
      question.question,
      "",
      formatOptionList(question.options),
      "",
      `My answer: ${selectedLabel}) ${selectedText}`,
      `App marked correct answer: ${correctLabel}) ${correctText}`,
    );

    if (result) {
      sections.push(`App says: ${result.isCorrect ? "Correct" : "Incorrect"}`);
      if (result.feedback.trim()) {
        sections.push(`App feedback: ${result.feedback}`);
      }
    }

    sections.push("");
  });

  sections.push(
    "## Your task",
    "Please review each question and tell me whether the app's grading appears accurate.",
  );

  return sections.join("\n");
}

export interface WritingVerificationCopyInput {
  testLabel: string;
  examPrompt: string;
  studentResponse: string;
  grade: Pick<
    GradeResponse,
    | "estimatedBand"
    | "overallFeedback"
    | "positives"
    | "constructiveCriticism"
    | "grammarCorrections"
  >;
}

export function formatWritingVerificationCopy(
  input: WritingVerificationCopyInput,
): string {
  const sections: string[] = [
    WRITING_CONTEXT_INTRO,
    "",
    "## Test info",
    `Type: ${input.testLabel}`,
    `App estimated CLB band: ${input.grade.estimatedBand}`,
    "",
    "## Writing prompt",
    input.examPrompt.trim(),
    "",
    "## My response",
    input.studentResponse.trim() || "(no response submitted)",
    "",
    "## App grading",
  ];

  if (input.grade.overallFeedback.trim()) {
    sections.push("", "### Overall feedback", input.grade.overallFeedback.trim());
  }

  if (input.grade.positives.length > 0) {
    sections.push("", "### Strengths");
    for (const item of input.grade.positives) {
      sections.push(`- ${item}`);
    }
  }

  if (input.grade.constructiveCriticism.length > 0) {
    sections.push("", "### Areas to improve");
    for (const item of input.grade.constructiveCriticism) {
      sections.push(`- ${item}`);
    }
  }

  if (input.grade.grammarCorrections.length > 0) {
    sections.push("", "### Grammar corrections");
    for (const fix of input.grade.grammarCorrections) {
      sections.push(
        `- "${fix.original}" → "${fix.corrected}" (${fix.reason})`,
      );
    }
  }

  sections.push(
    "",
    "## Your task",
    "Please assess my writing and tell me whether the app's CLB estimate and feedback seem accurate.",
  );

  return sections.join("\n");
}
