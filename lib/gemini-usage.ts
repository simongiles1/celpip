import type { GeminiModel } from "./gemini";

/** USD per 1M tokens: [input, output] */
export const GEMINI_PRICING_PER_MILLION: Record<
  GeminiModel,
  { input: number; output: number }
> = {
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-3-flash-preview": { input: 0.5, output: 3 },
  "gemini-3.5-flash": { input: 1.5, output: 9 },
};

export interface GeminiTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GeminiCostBreakdown extends GeminiTokenUsage {
  model: GeminiModel;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

export function extractTokenUsage(metadata?: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}): GeminiTokenUsage {
  const inputTokens = metadata?.promptTokenCount ?? 0;
  const outputTokens = metadata?.candidatesTokenCount ?? 0;
  const totalTokens =
    metadata?.totalTokenCount ?? inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

export function calculateGeminiCost(
  model: GeminiModel,
  usage: GeminiTokenUsage,
): GeminiCostBreakdown {
  const rates = GEMINI_PRICING_PER_MILLION[model];
  const inputCostUsd = (usage.inputTokens / 1_000_000) * rates.input;
  const outputCostUsd = (usage.outputTokens / 1_000_000) * rates.output;
  return {
    model,
    ...usage,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
  };
}

export function mergeGeminiUsage(
  a: GeminiTokenUsage,
  b: GeminiTokenUsage,
): GeminiTokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

export function emptyGeminiUsage(): GeminiTokenUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

export function formatUsd(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount > 0 && amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

export function formatTokenCount(count: number): string {
  return count.toLocaleString();
}

export function logGeminiUsage(
  label: string,
  breakdown: GeminiCostBreakdown,
): void {
  console.info(
    `[Gemini] ${label} model=${breakdown.model} ` +
      `input=${breakdown.inputTokens} output=${breakdown.outputTokens} ` +
      `total=${breakdown.totalTokens} cost=${formatUsd(breakdown.totalCostUsd)} ` +
      `(in ${formatUsd(breakdown.inputCostUsd)}, out ${formatUsd(breakdown.outputCostUsd)})`,
  );
}
