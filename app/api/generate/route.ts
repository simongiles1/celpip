import { z } from "zod";
import { callGeminiWithJsonRetry } from "@/lib/gemini-api";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from "@/lib/gemini";
import { buildGenerationPrompt } from "@/lib/prompts";
import { NextResponse } from "next/server";

const conceptContextSchema = z.object({
  id: z.string(),
  label: z.string(),
  evidence: z.string().optional(),
});

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
  weakConcepts: z.array(conceptContextSchema).optional(),
  strongConcepts: z.array(conceptContextSchema).optional(),
  model: z.enum(GEMINI_MODELS).default(DEFAULT_GEMINI_MODEL),
});

const readingQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctAnswerIndex: z.number().int().min(0).max(3),
});

const conceptDrillItemSchema = z.object({
  prompt: z.string(),
  hint: z.string().optional(),
});

const responseSchema = z.object({
  instructions: z.string(),
  example: z.string(),
  examPrompt: z.string(),
  readingQuestions: z.array(readingQuestionSchema).optional(),
  conceptDrillItems: z.array(conceptDrillItemSchema).optional(),
});

const conceptExercisesResponseSchema = z.object({
  examPrompt: z.string(),
  conceptDrillItems: z.array(conceptDrillItemSchema).min(8),
});

function parseJsonResponse(text: string): unknown {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
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

    const prompt = buildGenerationPrompt(
      input.focusSubTest,
      input.focusTarget,
      input.practiceType,
      {
        sessionMode: input.sessionMode ?? sessionMode,
        weakConcepts: input.weakConcepts,
        strongConcepts: input.strongConcepts,
        targetConceptLabel: input.targetConceptLabel ?? input.focusTarget,
        targetConceptDescription: input.targetConceptDescription ?? input.focusTarget,
        targetConceptId: input.targetConceptId,
        conceptExercisesOnly: exercisesOnly,
        conceptSetNumber: input.conceptSetNumber,
        conceptDescriptionOverride: input.conceptDescriptionOverride,
        conceptDrillConstraintsOverride: input.conceptDrillConstraintsOverride,
      },
    );

    const validateParsed = (parsed: unknown) =>
      exercisesOnly
        ? conceptExercisesResponseSchema.safeParse(parsed).success
        : responseSchema.safeParse(parsed).success;

    const { text, usage } = await callGeminiWithJsonRetry(
      prompt,
      input.model,
      "Your previous response was invalid. Return strictly valid JSON matching the schema.",
      "generate",
      parseJsonResponse,
      validateParsed,
    );

    const parsed = parseJsonResponse(text);
    const validated = exercisesOnly
      ? conceptExercisesResponseSchema.safeParse(parsed)
      : responseSchema.safeParse(parsed);

    if (!validated.success) {
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

    if (isConcept && !validated.data.conceptDrillItems?.length) {
      return NextResponse.json(
        { error: "Concept drill missing exercises" },
        { status: 502 },
      );
    }

    if (isReading && !isConcept && "readingQuestions" in validated.data && !validated.data.readingQuestions?.length) {
      return NextResponse.json(
        { error: "Reading module missing questions" },
        { status: 502 },
      );
    }

    const responseData = exercisesOnly
      ? {
          instructions: "",
          example: "",
          examPrompt: validated.data.examPrompt,
          conceptDrillItems: validated.data.conceptDrillItems,
        }
      : validated.data;

    return NextResponse.json({ ...responseData, geminiUsage: usage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
