import type { GeminiModel } from "./gemini";
import { type GeminiCostBreakdown } from "./gemini-usage";

export function combineGeminiUsage(
  model: GeminiModel,
  ...parts: (GeminiCostBreakdown | undefined)[]
): GeminiCostBreakdown | null {
  const present = parts.filter(
    (p): p is GeminiCostBreakdown => p != null && p.totalTokens > 0,
  );
  if (present.length === 0) return null;

  return present.reduce(
    (acc, part) => ({
      model,
      inputTokens: acc.inputTokens + part.inputTokens,
      outputTokens: acc.outputTokens + part.outputTokens,
      totalTokens: acc.totalTokens + part.totalTokens,
      inputCostUsd: acc.inputCostUsd + part.inputCostUsd,
      outputCostUsd: acc.outputCostUsd + part.outputCostUsd,
      totalCostUsd: acc.totalCostUsd + part.totalCostUsd,
    }),
    {
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      inputCostUsd: 0,
      outputCostUsd: 0,
      totalCostUsd: 0,
    },
  );
}
