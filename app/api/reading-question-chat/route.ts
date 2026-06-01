import { z } from "zod";
import { callGeminiWithJsonRetry } from "@/lib/gemini-api";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from "@/lib/gemini";
import { buildReadingQuestionChatPrompt } from "@/lib/prompts";
import { NextResponse } from "next/server";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const requestSchema = z.object({
  examPrompt: z.string(),
  question: z.string(),
  options: z.array(z.string()).min(2),
  correctAnswerIndex: z.number().int().min(0),
  studentAnswerIndex: z.number().int().min(0),
  gradingFeedback: z.string().default(""),
  celpipPart: z.string().optional(),
  questionType: z.string().optional(),
  message: z.string().min(1),
  chatHistory: z.array(chatMessageSchema).default([]),
  model: z.enum(GEMINI_MODELS).default(DEFAULT_GEMINI_MODEL),
});

const responseSchema = z.object({
  reply: z.string(),
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

    const prompt = buildReadingQuestionChatPrompt({
      examPrompt: input.examPrompt,
      question: input.question,
      options: input.options,
      correctAnswerIndex: input.correctAnswerIndex,
      studentAnswerIndex: input.studentAnswerIndex,
      gradingFeedback: input.gradingFeedback,
      celpipPart: input.celpipPart,
      questionType: input.questionType,
      userMessage: input.message,
      chatHistory: input.chatHistory,
    });

    const validateParsed = (parsed: unknown) =>
      responseSchema.safeParse(parsed).success;

    const { text, usage } = await callGeminiWithJsonRetry(
      prompt,
      input.model,
      "Your previous response was invalid. Return strictly valid JSON with a single \"reply\" string.",
      "reading-question-chat",
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
      error instanceof Error ? error.message : "Reading question chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
