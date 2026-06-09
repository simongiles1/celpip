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

export type GeminiStreamChunkHandler = (chunk: string, accumulated: string) => void;

/** Pulls a partial hint string from incomplete JSON streamed by Gemini. */
export function extractPartialHintFromJson(partialJson: string): string | null {
  const match = partialJson.match(/"hint"\s*:\s*"((?:[^"\\]|\\.)*)(?:")?/);
  if (!match?.[1]) return null;

  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1]
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

export interface CallGeminiStreamOptions {
  /** When false, streams plain text for faster time-to-first-token. Default true. */
  json?: boolean;
}

export async function callGeminiStream(
  prompt: string,
  model: GeminiModel,
  onChunk: GeminiStreamChunkHandler,
  options: CallGeminiStreamOptions = {},
): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const useJson = options.json !== false;
  const generativeModel = genAI.getGenerativeModel({
    model,
    generationConfig: useJson
      ? { responseMimeType: "application/json" }
      : undefined,
  });

  const timeoutSeconds = GEMINI_REQUEST_TIMEOUT_MS / 1000;
  const streamPromise = generativeModel.generateContentStream(prompt);
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

  const streamResult = await Promise.race([streamPromise, timeoutPromise]);
  let text = "";

  for await (const chunk of streamResult.stream) {
    const chunkText = chunk.text();
    text += chunkText;
    onChunk(chunkText, text);
  }

  const response = await streamResult.response;
  return {
    text,
    usage: extractTokenUsage(response.usageMetadata),
  };
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
