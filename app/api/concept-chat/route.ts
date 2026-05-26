import { z } from "zod";
import { callGeminiWithJsonRetry } from "@/lib/gemini-api";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from "@/lib/gemini";
import { buildConceptChatPrompt } from "@/lib/prompts";
import { NextResponse } from "next/server";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const requestSchema = z.object({
  conceptId: z.string(),
  conceptLabel: z.string(),
  conceptDescription: z.string(),
  instructionDocument: z.string(),
  drillConstraints: z.string(),
  currentQuestions: z.array(z.string()).default([]),
  message: z.string().min(1),
  chatHistory: z.array(chatMessageSchema).default([]),
  model: z.enum(GEMINI_MODELS).default(DEFAULT_GEMINI_MODEL),
});

const responseSchema = z.object({
  reply: z.string(),
  changesSummary: z.string().nullable().optional(),
  updates: z
    .object({
      instructionMarkdown: z.string().optional(),
      drillConstraints: z.string().optional(),
      descriptionOverride: z.string().optional(),
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = requestSchema.parse(body);

    const prompt = buildConceptChatPrompt({
      conceptLabel: input.conceptLabel,
      conceptDescription: input.conceptDescription,
      instructionDocument: input.instructionDocument,
      drillConstraints: input.drillConstraints,
      currentQuestions: input.currentQuestions,
      userMessage: input.message,
      chatHistory: input.chatHistory,
    });

    const validateParsed = (parsed: unknown) =>
      responseSchema.safeParse(parsed).success;

    const { text, usage } = await callGeminiWithJsonRetry(
      prompt,
      input.model,
      "Your previous response was invalid. Return strictly valid JSON matching the schema.",
      "concept-chat",
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

    return NextResponse.json({ ...validated.data, geminiUsage: usage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Concept chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
