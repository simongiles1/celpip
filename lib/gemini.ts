export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
] as const;

export type GeminiModel = (typeof GEMINI_MODELS)[number];

export const DEFAULT_GEMINI_MODEL: GeminiModel = "gemini-2.5-flash";

export const GEMINI_MODEL_LABELS: Record<GeminiModel, string> = {
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-3-flash-preview": "Gemini 3 Flash (Preview)",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
};

export function isGeminiModel(value: unknown): value is GeminiModel {
  return (
    typeof value === "string" &&
    (GEMINI_MODELS as readonly string[]).includes(value)
  );
}
