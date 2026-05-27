import type { GeminiModel } from "@/lib/gemini";
import { callGemini } from "@/lib/gemini-server";
import {
  calculateGeminiCost,
  logGeminiUsage,
  mergeGeminiUsage,
  type GeminiCostBreakdown,
  type GeminiTokenUsage,
} from "@/lib/gemini-usage";

export interface GeminiJsonRetryOptions {
  maxAttempts?: number;
  describeValidationFailure?: (parsed: unknown) => string | undefined;
}

export async function callGeminiWithJsonRetry(
  prompt: string,
  model: GeminiModel,
  retrySuffix: string,
  label: string,
  parse: (text: string) => unknown,
  validate: (parsed: unknown) => boolean,
  options?: GeminiJsonRetryOptions,
): Promise<{ text: string; usage: GeminiCostBreakdown }> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 3);
  let combinedUsage: GeminiTokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  let text = "";
  let failureHint = "";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptPrompt =
      attempt === 0
        ? prompt
        : `${prompt}\n\n${retrySuffix}${failureHint ? `\n\nFix these issues:\n${failureHint}` : ""}`;

    const result = await callGemini(attemptPrompt, model);
    combinedUsage = mergeGeminiUsage(combinedUsage, result.usage);
    text = result.text;

    let parsed: unknown;
    try {
      parsed = parse(text);
    } catch (error) {
      failureHint =
        error instanceof Error
          ? `Invalid JSON: ${error.message}`
          : "Invalid JSON returned.";
      continue;
    }

    if (validate(parsed)) {
      const usage = calculateGeminiCost(model, combinedUsage);
      logGeminiUsage(label, usage);
      return { text, usage };
    }

    failureHint =
      options?.describeValidationFailure?.(parsed) ??
      "Response did not match the required JSON schema.";
  }

  const usage = calculateGeminiCost(model, combinedUsage);
  logGeminiUsage(label, usage);
  return { text, usage };
}
