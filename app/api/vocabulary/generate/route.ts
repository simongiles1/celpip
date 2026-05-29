import { z } from "zod";
import { NextResponse } from "next/server";
import { callGeminiWithJsonRetry } from "@/lib/gemini-api";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from "@/lib/gemini";
import { buildVocabularyPrompt } from "@/lib/vocabulary-prompts";
import {
  validateWordQuestions,
  vocabularyResponseSchema,
} from "@/lib/vocabulary-validation";

const requestSchema = z.object({
  wordCount: z.number().int().min(1).max(20),
  sessionDate: z.string(),
  model: z.enum(GEMINI_MODELS).default(DEFAULT_GEMINI_MODEL),
});

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenceMatch ? fenceMatch[1].trim() : trimmed;
  return JSON.parse(jsonText);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { wordCount, sessionDate, model } = parsed.data;
    const prompt = buildVocabularyPrompt(wordCount, sessionDate);

    const { text, usage } = await callGeminiWithJsonRetry(
      prompt,
      model,
      "Return ONLY the JSON object described above. No markdown outside the JSON.",
      "vocabulary-generate",
      parseJson,
      (value) => {
        const result = vocabularyResponseSchema.safeParse(value);
        if (!result.success) return false;
        if (result.data.words.length !== wordCount) return false;
        return validateWordQuestions(value) === undefined;
      },
      {
        describeValidationFailure: (value) => {
          const result = vocabularyResponseSchema.safeParse(value);
          if (!result.success) return result.error.message;
          if (result.data.words.length !== wordCount) {
            return `Expected exactly ${wordCount} words, got ${result.data.words.length}.`;
          }
          return validateWordQuestions(value);
        },
      },
    );

    const payload = vocabularyResponseSchema.parse(parseJson(text));

    return NextResponse.json({
      words: payload.words,
      geminiUsage: usage,
    });
  } catch (error) {
    console.error("Vocabulary generation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate vocabulary",
      },
      { status: 500 },
    );
  }
}
