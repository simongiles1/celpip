import { z } from "zod";
import { callGeminiWithJsonRetry } from "@/lib/gemini-api";
import {
  buildConceptDrillResults,
  computeConceptDrillScore,
  isMultipleChoiceDrillSet,
  parseConceptMcAnswers,
} from "@/lib/concept-drill-mc";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from "@/lib/gemini";
import { normalizeGradingPayload } from "@/lib/normalize-grading-response";
import {
  buildConceptGradingPrompt,
  buildConceptMcGradingPrompt,
  buildGradingPrompt,
  buildReadingGradingPrompt,
} from "@/lib/prompts";
import { getReadingQuestionsForGrading } from "@/lib/repair-reading-answer-indices";
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

const conceptDrillItemSchema = z.object({
  prompt: z.string(),
  hint: z.string().optional(),
  options: z.array(z.string()).length(4),
  correctAnswerIndex: z.number().int().min(0).max(3),
});

const requestSchema = z.object({
  focusSubTest: z.string(),
  examPrompt: z.string(),
  studentSubmission: z.union([z.string(), z.record(z.string(), z.number())]),
  readingQuestions: z.array(readingQuestionSchema).optional(),
  conceptLabel: z.string().optional(),
  conceptDrillItems: z.array(conceptDrillItemSchema).optional(),
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
      conceptId: z.string().optional(),
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

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`)
    .join("\n");
}

function prepareGradingPayload(parsed: unknown): unknown {
  return normalizeGradingPayload(parsed);
}

const conceptMcGradingResponseSchema = z.object({
  estimatedBand: z.number().min(1).max(12),
  overallFeedback: z.string(),
  positives: z.array(z.string()),
  constructiveCriticism: z.array(z.string()),
  grammarCorrections: z
    .array(
      z.object({
        original: z.string(),
        corrected: z.string(),
        reason: z.string(),
        conceptId: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  skillTags: z.array(skillTagSchema).optional().default([]),
  drillResults: z
    .array(
      z.object({
        index: z.number(),
        feedback: z.string(),
      }),
    )
    .optional(),
});

function validateGradingPayload(parsed: unknown) {
  return responseSchema.safeParse(prepareGradingPayload(parsed));
}

function validateConceptMcGradingPayload(parsed: unknown) {
  return conceptMcGradingResponseSchema.safeParse(prepareGradingPayload(parsed));
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
    let conceptDrillItemsForGrade:
      | z.infer<typeof conceptDrillItemSchema>[]
      | undefined;
    let conceptMcAnswers: Record<string, number> | undefined;
    let isMcConceptGrade = false;

    let readingQuestionsForGrade: z.infer<typeof readingQuestionSchema>[] | undefined;

    if (
      input.focusSubTest === "Reading" &&
      typeof input.studentSubmission === "object" &&
      input.readingQuestions?.length
    ) {
      readingQuestionsForGrade = getReadingQuestionsForGrading(
        input.readingQuestions,
        { examPrompt: input.examPrompt },
      );
      const score = computeReadingScore(
        input.studentSubmission,
        readingQuestionsForGrade,
      );
      autoBand = score.band;
      prompt = buildReadingGradingPrompt(
        input.examPrompt,
        JSON.stringify(input.studentSubmission),
        score.summary,
        readingQuestionsForGrade.length,
      );
    } else if (
      input.focusSubTest === "Concept" &&
      input.conceptLabel &&
      input.conceptDrillItems?.length &&
      isMultipleChoiceDrillSet(input.conceptDrillItems)
    ) {
      isMcConceptGrade = true;
      conceptDrillItemsForGrade = input.conceptDrillItems;
      conceptMcAnswers = parseConceptMcAnswers(
        input.studentSubmission,
        input.drillResponses,
      );
      const score = computeConceptDrillScore(
        conceptMcAnswers,
        conceptDrillItemsForGrade,
      );
      autoBand = score.band;
      prompt = buildConceptMcGradingPrompt(
        input.conceptLabel,
        JSON.stringify(conceptDrillItemsForGrade),
        JSON.stringify(conceptMcAnswers),
        score.summary,
      );
    } else if (input.focusSubTest === "Concept" && input.conceptLabel) {
      const submission =
        typeof input.studentSubmission === "string"
          ? input.studentSubmission
          : JSON.stringify(input.studentSubmission);
      prompt = buildConceptGradingPrompt(
        input.conceptLabel,
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

    const validateParsed = (parsed: unknown) =>
      isMcConceptGrade
        ? validateConceptMcGradingPayload(parsed).success
        : validateGradingPayload(parsed).success;

    const { text, usage } = await callGeminiWithJsonRetry(
      prompt,
      input.model,
      "Return strictly valid JSON matching the schema. No prose, no markdown.",
      "grade",
      parseJsonResponse,
      validateParsed,
      {
        describeValidationFailure: (parsed) => {
          const result = isMcConceptGrade
            ? validateConceptMcGradingPayload(parsed)
            : validateGradingPayload(parsed);
          return result.success ? undefined : formatZodIssues(result.error);
        },
      },
    );

    const parsedResponse = parseJsonResponse(text);
    const validated = isMcConceptGrade
      ? validateConceptMcGradingPayload(parsedResponse)
      : validateGradingPayload(parsedResponse);

    if (!validated.success) {
      console.error(
        "[grade] Invalid grading response:",
        formatZodIssues(validated.error),
      );
      return NextResponse.json(
        { error: "Invalid grading response from AI model" },
        { status: 502 },
      );
    }

    if (isMcConceptGrade && conceptDrillItemsForGrade && conceptMcAnswers) {
      const mcResult = validated.data;
      const estimatedBand =
        autoBand !== undefined
          ? Math.round((mcResult.estimatedBand + autoBand) / 2)
          : mcResult.estimatedBand;

      return NextResponse.json({
        ...mcResult,
        estimatedBand,
        drillResults: buildConceptDrillResults(
          conceptMcAnswers,
          conceptDrillItemsForGrade,
          mcResult.drillResults?.map((item) => ({
            index: item.index,
            isCorrect: false,
            studentAnswer: "",
            correctAnswer: "",
            feedback: item.feedback,
          })),
        ),
        geminiUsage: usage,
      });
    }

    const result = validated.data as z.infer<typeof responseSchema>;
    if (autoBand !== undefined) {
      result.estimatedBand = Math.round((result.estimatedBand + autoBand) / 2);
    }

    if (
      input.focusSubTest === "Reading" &&
      typeof input.studentSubmission === "object" &&
      readingQuestionsForGrade?.length
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
        readingQuestionsForGrade,
        aiFeedback,
      );
    }

    return NextResponse.json({ ...result, geminiUsage: usage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Grading failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
