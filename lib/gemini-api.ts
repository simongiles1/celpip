import type { GeminiModel } from "@/lib/gemini";
import { callGemini } from "@/lib/gemini-server";
import {
  calculateGeminiCost,
  logGeminiUsage,
  mergeGeminiUsage,
  type GeminiCostBreakdown,
  type GeminiTokenUsage,
} from "@/lib/gemini-usage";

export async function callGeminiWithJsonRetry(
  prompt: string,
  model: GeminiModel,
  retrySuffix: string,
  label: string,
  parse: (text: string) => unknown,
  validate: (parsed: unknown) => boolean,
): Promise<{ text: string; usage: GeminiCostBreakdown }> {
  let combinedUsage: GeminiTokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  const first = await callGemini(prompt, model);
  combinedUsage = mergeGeminiUsage(combinedUsage, first.usage);
  let text = first.text;
  let parsed = parse(text);
  let valid = validate(parsed);

  if (!valid) {
    const second = await callGemini(`${prompt}\n\n${retrySuffix}`, model);
    combinedUsage = mergeGeminiUsage(combinedUsage, second.usage);
    text = second.text;
    parsed = parse(text);
    valid = validate(parsed);
  }

  const usage = calculateGeminiCost(model, combinedUsage);
  logGeminiUsage(label, usage);

  return { text, usage };
}
