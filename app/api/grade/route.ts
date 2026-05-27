import { z } from "zod";
import { callGeminiWithJsonRetry } from "@/lib/gemini-api";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from "@/lib/gemini";
import {
  buildConceptGradingPrompt,
  buildGradingPrompt,
  buildReadingGradingPrompt,
} from "@/lib/prompts";
import { buildReadingResults } from "@/lib/reading-submission";
import { NextResponse } from "next/server";

const celpipReadingPartSchema = z.enum([
  "part_1",
  "part_2",
  "part_3",
  "part_4",
]);
const readingQuestionTypeSchema = z.enum([
  "main_idea",
  "detail_extraction",
  "inference",
  "paraphrase_recognition",
  "vocabulary_in_context",
  "distractor_analysis",
  "tone_attitude",
]);

const readingQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctAnswerIndex: z.number(),
  celpipPart: celpipReadingPartSchema.optional(),
  questionType: readingQuestionTypeSchema.optional(),
  targetClbBand: z.number().int().min(6).max(12).optional(),
});

const skillTagSchema = z.object({
  conceptId: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  category: z
    .enum(["grammar", "vocabulary", "reading_strategy", "writing_structure"])
    .optional(),
  polarity: z.enum(["strength", "weakness"]),
  evidence: z.string(),
});

const requestSchema = z.object({
  focusSubTest: z.string(),
  examPrompt: z.string(),
  studentSubmission: z.union([z.string(), z.record(z.string(), z.number())]),
  readingQuestions: z.array(readingQuestionSchema).optional(),
  conceptLabel: z.string().optional(),
  drillResponses: z.string().optional(),
  model: z.enum(GEMINI_MODELS).default(DEFAULT_GEMINI_MODEL),
});

const drillResultSchema = z.object({
  index: z.number(),
  isCorrect: z.boolean(),
  studentAnswer: z.string(),
  correctAnswer: z.string(),
  feedback: z.string(),
});

const responseSchema = z.object({
  estimatedBand: z.number().min(1).max(12),
  overallFeedback: z.string(),
  positives: z.array(z.string()),
  constructiveCriticism: z.array(z.string()),
  grammarCorrections: z.array(
    z.object({
      original: z.string(),
      corrected: z.string(),
      reason: z.string(),
    }),
  ),
  skillTags: z.array(skillTagSchema).optional().default([]),
  drillResults: z.array(drillResultSchema).optional(),
  readingResults: z
    .array(
      z.object({
        index: z.number(),
        feedback: z.string(),
        celpipPart: celpipReadingPartSchema.optional(),
        questionType: readingQuestionTypeSchema.optional(),
        targetClbBand: z.number().int().min(6).max(12).optional(),
      }),
    )
    .optional(),
  writingResult: z
    .object({
      isAcceptable: z.boolean(),
      feedback: z.string(),
    })
    .optional(),
});

function parseJsonResponse(text: string): unknown {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function computeReadingScore(
  answers: Record<string, number>,
  questions: z.infer<typeof readingQuestionSchema>[],
): { correct: number; total: number; band: number; summary: string } {
  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[String(i)] === q.correctAnswerIndex) correct++;
  });
  const total = questions.length;
  const pct = total > 0 ? correct / total : 0;
  const band = Math.max(1, Math.min(12, Math.round(pct * 12)));
  return {
    correct,
    total,
    band,
    summary: `${correct}/${total} correct (${Math.round(pct * 100)}%)`,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = requestSchema.parse(body);

    let prompt: string;
    let autoBand: number | undefined;

    if (
      input.focusSubTest === "Reading" &&
      typeof input.studentSubmission === "object" &&
      input.readingQuestions?.length
    ) {
      const score = computeReadingScore(
        input.studentSubmission,
        input.readingQuestions,
      );
      autoBand = score.band;
      prompt = buildReadingGradingPrompt(
        input.examPrompt,
        JSON.stringify(input.studentSubmission),
        score.summary,
        input.readingQuestions.length,
      );
    } else if (input.focusSubTest === "Concept" && input.conceptLabel) {
      const submission =
        typeof input.studentSubmission === "string"
          ? input.studentSubmission
          : JSON.stringify(input.studentSubmission);
      prompt = buildConceptGradingPrompt(
        input.conceptLabel,
        input.examPrompt,
        input.drillResponses ?? "",
        submission,
      );
    } else {
      const submission =
        typeof input.studentSubmission === "string"
          ? input.studentSubmission
          : JSON.stringify(input.studentSubmission);
      prompt = buildGradingPrompt(
        input.focusSubTest,
        input.examPrompt,
        submission,
      );
    }

    const { text, usage } = await callGeminiWithJsonRetry(
      prompt,
      input.model,
      "Return strictly valid JSON only.",
      "grade",
      parseJsonResponse,
      (parsed) => responseSchema.safeParse(parsed).success,
    );

    const parsed = parseJsonResponse(text);
    const validated = responseSchema.safeParse(parsed);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid grading response from AI model" },
        { status: 502 },
      );
    }

    const result = validated.data;
    if (autoBand !== undefined) {
      result.estimatedBand = Math.round((result.estimatedBand + autoBand) / 2);
    }

    if (
      input.focusSubTest === "Reading" &&
      typeof input.studentSubmission === "object" &&
      input.readingQuestions?.length
    ) {
      const aiFeedback = result.readingResults?.map((item) => ({
        index: item.index,
        isCorrect: false,
        studentAnswer: "",
        correctAnswer: "",
        feedback: item.feedback,
        celpipPart: item.celpipPart,
        questionType: item.questionType,
        targetClbBand: item.targetClbBand,
      }));
      result.readingResults = buildReadingResults(
        input.studentSubmission,
        input.readingQuestions,
        aiFeedback,
      );
    }

    return NextResponse.json({ ...result, geminiUsage: usage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Grading failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
