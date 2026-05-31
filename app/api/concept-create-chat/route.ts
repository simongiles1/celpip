import { z } from "zod";
import { callGeminiWithJsonRetry } from "@/lib/gemini-api";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from "@/lib/gemini";
import { buildConceptCreateChatPrompt } from "@/lib/prompts";
import { NextResponse } from "next/server";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const existingConceptSchema = z.object({
  label: z.string(),
  category: z.string(),
  description: z.string(),
});

const requestSchema = z.object({
  message: z.string().min(1),
  chatHistory: z.array(chatMessageSchema).default([]),
  existingConcepts: z.array(existingConceptSchema).default([]),
  model: z.enum(GEMINI_MODELS).default(DEFAULT_GEMINI_MODEL),
});

const conceptSchema = z.object({
  label: z.string().min(1),
  category: z.enum([
    "grammar",
    "vocabulary",
    "reading_strategy",
    "writing_structure",
  ]),
  description: z.string().min(1),
  examples: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  id: z.string().optional(),
});

const responseSchema = z.object({
  reply: z.string(),
  readyToCreate: z.boolean(),
  concept: conceptSchema.nullable().optional(),
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

    const prompt = buildConceptCreateChatPrompt({
      existingConcepts: input.existingConcepts,
      chatHistory: input.chatHistory,
      userMessage: input.message,
    });

    const validateParsed = (parsed: unknown) =>
      responseSchema.safeParse(parsed).success;

    const { text, usage } = await callGeminiWithJsonRetry(
      prompt,
      input.model,
      "Your previous response was invalid. Return strictly valid JSON matching the schema.",
      "concept-create-chat",
      parseJsonResponse,
      validateParsed,
    );

    const parsed = parseJsonResponse(text);
    const validated = responseSchema.safeParse(parsed);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid response from AI model" },
        { status: 502 },
      );
    }

    const data = validated.data;
    if (data.readyToCreate && !data.concept) {
      return NextResponse.json(
        { error: "Model marked readyToCreate but omitted concept" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ...data, geminiUsage: usage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Concept create chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
