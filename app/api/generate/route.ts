import { z } from "zod";
import { callGeminiWithJsonRetry } from "@/lib/gemini-api";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from "@/lib/gemini";
import {
  getConceptDrillItemsArraySchema,
  normalizeConceptDrillItems,
} from "@/lib/concept-drill-mc";
import { normalizeGeneratedReadingPayload } from "@/lib/normalize-generated-reading";
import {
  buildFocusedTestSubmissionPrompt,
  buildFocusedWritingPrompt,
} from "@/lib/focus-prompts";
import {
  buildCelpipMockPrompt,
  buildGenerationPrompt,
  buildReadingPassageOnlyPrompt,
} from "@/lib/prompts";
import { NextResponse } from "next/server";

const conceptContextSchema = z.object({
  id: z.string(),
  label: z.string(),
  evidence: z.string().optional(),
});

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

const requestSchema = z.object({
  focusSubTest: z.string(),
  focusTarget: z.string(),
  practiceType: z.string(),
  sessionMode: z.enum(["subtest", "concept", "review"]).optional(),
  targetConceptId: z.string().optional(),
  targetConceptLabel: z.string().optional(),
  targetConceptDescription: z.string().optional(),
  conceptExercisesOnly: z.boolean().optional(),
  conceptSetNumber: z.number().int().min(1).optional(),
  conceptDescriptionOverride: z.string().optional(),
  conceptDrillConstraintsOverride: z.string().optional(),
  readingPassageOnly: z.boolean().optional(),
  readingSetNumber: z.number().int().min(1).optional(),
  targetClbBand: z.number().int().min(6).max(12).optional(),
  mockTarget: z
    .discriminatedUnion("kind", [
      z.object({
        kind: z.literal("reading_part"),
        celpipPart: celpipReadingPartSchema,
        questionCount: z.number().int().min(1).max(20),
      }),
      z.object({
        kind: z.literal("writing_task"),
        task: z.enum(["task_1", "task_2"]),
      }),
    ])
    .optional(),
  weakConcepts: z.array(conceptContextSchema).optional(),
  strongConcepts: z.array(conceptContextSchema).optional(),
  mode: z
    .enum(["standard", "focused", "focused_test_submission"])
    .optional(),
  focusConceptIds: z.array(z.string()).optional(),
  focusedWritingTask: z.enum(["task_1", "task_2"]).optional(),
  examPrompt: z.string().optional(),
  model: z.enum(GEMINI_MODELS).default(DEFAULT_GEMINI_MODEL),
});

const readingQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswerIndex: z.number().int().min(0).max(3),
  celpipPart: celpipReadingPartSchema.optional(),
  questionType: readingQuestionTypeSchema.optional(),
  targetClbBand: z.number().int().min(6).max(12).optional(),
});

const conceptDrillItemSchema = z.object({
  prompt: z.string(),
  hint: z.string().optional(),
  options: z.array(z.string()).length(4).optional(),
  correctAnswerIndex: z.number().int().min(0).max(3).optional(),
  acceptableAnswerIndexes: z
    .array(z.number().int().min(0).max(3))
    .min(1)
    .max(4)
    .optional(),
});

function prepareGeneratedPayload(
  parsed: unknown,
  conceptId?: string,
): unknown {
  if (!parsed || typeof parsed !== "object") {
    return normalizeGeneratedReadingPayload(parsed);
  }

  const record = parsed as Record<string, unknown>;
  const normalizedDrillItems = normalizeConceptDrillItems(
    record.conceptDrillItems,
    conceptId,
  );

  const base = normalizeGeneratedReadingPayload(parsed) as Record<string, unknown>;
  if (normalizedDrillItems) {
    return { ...base, conceptDrillItems: normalizedDrillItems };
  }
  return base;
}

const responseSchema = z.object({
  instructions: z.string(),
  example: z.string(),
  examPrompt: z.string(),
  readingQuestions: z.array(readingQuestionSchema).optional(),
  conceptDrillItems: z.array(conceptDrillItemSchema).optional(),
  passageCelpipPart: celpipReadingPartSchema.optional(),
  passageTargetClbBand: z.number().int().min(6).max(12).optional(),
});

const conceptExercisesResponseSchema = (conceptId?: string) =>
  z.object({
    conceptDrillItems: getConceptDrillItemsArraySchema(conceptId),
  });

function getActiveGenerationSchema(options: {
  readingPassageOnly: boolean;
  exercisesOnly: boolean;
  conceptId?: string;
}) {
  if (options.readingPassageOnly) {
    return readingPassageOnlyResponseSchema;
  }
  if (options.exercisesOnly) {
    return conceptExercisesResponseSchema(options.conceptId);
  }
  return responseSchema.extend({
    conceptDrillItems: getConceptDrillItemsArraySchema(options.conceptId)
      .optional(),
  });
}

const readingPassageOnlyResponseSchema = z.object({
  examPrompt: z.string(),
  readingQuestions: z.array(readingQuestionSchema).min(1),
  passageCelpipPart: celpipReadingPartSchema.optional(),
  passageTargetClbBand: z.number().int().min(6).max(12).optional(),
});

const mockReadingResponseSchema = z.object({
  examPrompt: z.string(),
  readingQuestions: z.array(readingQuestionSchema).min(1),
  passageCelpipPart: celpipReadingPartSchema,
  passageTargetClbBand: z.number().int().min(6).max(12),
});

const mockWritingResponseSchema = z.object({
  examPrompt: z.string(),
});

const focusedTestSubmissionResponseSchema = z.object({
  studentSubmission: z.string().min(20),
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = requestSchema.parse(body);

    const sessionMode =
      input.sessionMode ??
      (input.focusSubTest === "Concept"
        ? "concept"
        : input.practiceType === "Custom Generation"
          ? "review"
          : "subtest");

    const isConcept =
      input.sessionMode === "concept" || input.focusSubTest === "Concept";
    const exercisesOnly = isConcept && input.conceptExercisesOnly;
    const readingPassageOnly = Boolean(input.readingPassageOnly);

    if (input.mode === "focused_test_submission") {
      if (!input.examPrompt?.trim()) {
        return NextResponse.json(
          { error: "examPrompt is required for test submission generation" },
          { status: 400 },
        );
      }

      const testPrompt = buildFocusedTestSubmissionPrompt(
        input.examPrompt,
        input.focusedWritingTask ?? "task_1",
        (input.weakConcepts ?? []).map((c) => ({
          id: c.id,
          label: c.label,
          evidence: c.evidence,
        })),
      );

      const { text: testText, usage: testUsage } = await callGeminiWithJsonRetry(
        testPrompt,
        input.model,
        "Return strictly valid JSON with a non-empty studentSubmission string (150-200 words). No prose, no markdown.",
        "generate",
        parseJsonResponse,
        (parsed) =>
          focusedTestSubmissionResponseSchema.safeParse(parsed).success,
        {
          describeValidationFailure: (parsed) => {
            const result =
              focusedTestSubmissionResponseSchema.safeParse(parsed);
            return result.success ? undefined : formatZodIssues(result.error);
          },
        },
      );

      const validatedTest = focusedTestSubmissionResponseSchema.parse(
        parseJsonResponse(testText),
      );
      return NextResponse.json({
        studentSubmission: validatedTest.studentSubmission,
        geminiUsage: testUsage,
      });
    }

    if (input.mockTarget) {
      const mockPrompt = buildCelpipMockPrompt({
        target: input.mockTarget,
        targetClbBand: input.targetClbBand,
      });
      const mockSchema =
        input.mockTarget.kind === "reading_part"
          ? mockReadingResponseSchema
          : mockWritingResponseSchema;

      const { text: mockText, usage: mockUsage } = await callGeminiWithJsonRetry(
        mockPrompt,
        input.model,
        "Return strictly valid JSON matching the schema. No prose, no markdown.",
        "generate",
        parseJsonResponse,
        (parsed) => mockSchema.safeParse(prepareGeneratedPayload(parsed)).success,
        {
          describeValidationFailure: (parsed) => {
            const result = mockSchema.safeParse(prepareGeneratedPayload(parsed));
            return result.success ? undefined : formatZodIssues(result.error);
          },
        },
      );

      const parsedMock = prepareGeneratedPayload(parseJsonResponse(mockText));
      const validatedMock = mockSchema.safeParse(parsedMock);
      if (!validatedMock.success) {
        return NextResponse.json(
          { error: "Invalid mock response from AI model" },
          { status: 502 },
        );
      }

      if (input.mockTarget.kind === "reading_part") {
        const mockData = mockReadingResponseSchema.parse(validatedMock.data);
        return NextResponse.json({
          instructions: "",
          example: "",
          examPrompt: mockData.examPrompt,
          readingQuestions: mockData.readingQuestions,
          passageCelpipPart: mockData.passageCelpipPart,
          passageTargetClbBand: mockData.passageTargetClbBand,
          geminiUsage: mockUsage,
        });
      }

      const writingMockData = mockWritingResponseSchema.parse(validatedMock.data);
      return NextResponse.json({
        instructions: "",
        example: "",
        examPrompt: writingMockData.examPrompt,
        geminiUsage: mockUsage,
      });
    }

    const isFocusedWriting =
      input.mode === "focused" && input.focusSubTest === "Writing";

    const prompt = isFocusedWriting
      ? buildFocusedWritingPrompt(
          input.focusedWritingTask ?? "task_1",
          (input.weakConcepts ?? []).map((c) => ({
            id: c.id,
            label: c.label,
            evidence: c.evidence,
          })),
        )
      : readingPassageOnly
      ? buildReadingPassageOnlyPrompt(input.focusTarget, input.practiceType, {
          setNumber: input.readingSetNumber,
          weakConcepts: input.weakConcepts,
          strongConcepts: input.strongConcepts,
          targetClbBand: input.targetClbBand,
        })
      : buildGenerationPrompt(
          input.focusSubTest,
          input.focusTarget,
          input.practiceType,
          {
            sessionMode: input.sessionMode ?? sessionMode,
            weakConcepts: input.weakConcepts,
            strongConcepts: input.strongConcepts,
            targetConceptLabel: input.targetConceptLabel ?? input.focusTarget,
            targetConceptDescription:
              input.targetConceptDescription ?? input.focusTarget,
            targetConceptId: input.targetConceptId,
            conceptExercisesOnly: exercisesOnly,
            conceptSetNumber: input.conceptSetNumber,
            conceptDescriptionOverride: input.conceptDescriptionOverride,
            conceptDrillConstraintsOverride:
              input.conceptDrillConstraintsOverride,
            targetClbBand: input.targetClbBand,
          },
        );

    const conceptId = input.targetConceptId;
    const preparePayload = (parsed: unknown) =>
      prepareGeneratedPayload(parsed, conceptId);

    const activeSchema = getActiveGenerationSchema({
      readingPassageOnly,
      exercisesOnly: Boolean(exercisesOnly),
      conceptId,
    });

    const validateParsed = (parsed: unknown) =>
      activeSchema.safeParse(preparePayload(parsed)).success;

    const mcRetryHint = exercisesOnly || isConcept
      ? " Use correctAnswerIndex as 0-3 (not 1-4). Each conceptDrillItem must have exactly 4 options when multiple-choice is required. Every MC item must include acceptableAnswerIndexes listing every option index that correctly completes the sentence (must include correctAnswerIndex)."
      : "";

    const { text, usage } = await callGeminiWithJsonRetry(
      prompt,
      input.model,
      `Your previous response was invalid. Return strictly valid JSON matching the schema.${mcRetryHint}`,
      "generate",
      parseJsonResponse,
      validateParsed,
      {
        describeValidationFailure: (parsed) => {
          const result = activeSchema.safeParse(preparePayload(parsed));
          return result.success ? undefined : formatZodIssues(result.error);
        },
      },
    );

    const parsed = preparePayload(parseJsonResponse(text));
    const validated = activeSchema.safeParse(parsed);

    if (!validated.success) {
      console.error(
        "[generate] Invalid AI response:",
        formatZodIssues(validated.error),
      );
      return NextResponse.json(
        { error: "Invalid response from AI model" },
        { status: 502 },
      );
    }

    const isReading =
      !isConcept &&
      (input.focusSubTest === "Reading" ||
        input.practiceType.toLowerCase().includes("reading") ||
        input.practiceType.toLowerCase().includes("part"));

    if (
      exercisesOnly &&
      "conceptDrillItems" in validated.data &&
      !validated.data.conceptDrillItems?.length
    ) {
      return NextResponse.json(
        { error: "Concept drill missing exercises" },
        { status: 502 },
      );
    }

    if (
      (isReading || readingPassageOnly) &&
      !isConcept &&
      "readingQuestions" in validated.data &&
      !validated.data.readingQuestions?.length
    ) {
      return NextResponse.json(
        { error: "Reading module missing questions" },
        { status: 502 },
      );
    }

    if (readingPassageOnly) {
      const passageData = readingPassageOnlyResponseSchema.parse(
        validated.data,
      );
      return NextResponse.json({
        instructions: "",
        example: "",
        examPrompt: passageData.examPrompt,
        readingQuestions: passageData.readingQuestions,
        passageCelpipPart: passageData.passageCelpipPart,
        passageTargetClbBand: passageData.passageTargetClbBand,
        geminiUsage: usage,
      });
    }

    if (exercisesOnly) {
      const drillData = conceptExercisesResponseSchema(conceptId).parse(
        validated.data,
      );
      return NextResponse.json({
        instructions: "",
        example: "",
        examPrompt: "",
        conceptDrillItems: drillData.conceptDrillItems,
        geminiUsage: usage,
      });
    }

    return NextResponse.json({ ...validated.data, geminiUsage: usage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
