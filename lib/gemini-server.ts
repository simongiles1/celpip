import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GeminiModel } from "@/lib/gemini";
import {
  extractTokenUsage,
  type GeminiTokenUsage,
} from "@/lib/gemini-usage";

export const GEMINI_REQUEST_TIMEOUT_MS = 90_000;

export interface GeminiCallResult {
  text: string;
  usage: GeminiTokenUsage;
}

export async function callGemini(
  prompt: string,
  model: GeminiModel,
): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const timeoutSeconds = GEMINI_REQUEST_TIMEOUT_MS / 1000;
  const generatePromise = generativeModel.generateContent(prompt);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            `Gemini request timed out after ${timeoutSeconds}s. Try Gemini 2.5 Flash in Settings, or retry.`,
          ),
        ),
      GEMINI_REQUEST_TIMEOUT_MS,
    );
  });

  const result = await Promise.race([generatePromise, timeoutPromise]);
  return {
    text: result.response.text(),
    usage: extractTokenUsage(result.response.usageMetadata),
  };
}
