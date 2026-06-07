import { z } from "zod";
import type { ConceptDrillItem, ConceptDrillResult } from "@/lib/types";

/** Seed concepts that use 4-option multiple-choice drills (not free-text). */
export const MULTIPLE_CHOICE_CONCEPT_IDS = [
  "preposition_in_at_on",
  "infinitive_to_usage",
  "articles_a_an_the",
  "connectors_transitions",
  "collocations",
  "vocabulary_precision",
  "formal_tone_register",
  "punctuation_mechanics",
  "paraphrase_recognition",
] as const;

export type MultipleChoiceConceptId =
  (typeof MULTIPLE_CHOICE_CONCEPT_IDS)[number];

const mcConceptIdSet = new Set<string>(MULTIPLE_CHOICE_CONCEPT_IDS);

export function isMultipleChoiceConcept(
  conceptId: string | undefined,
): conceptId is MultipleChoiceConceptId {
  return conceptId != null && mcConceptIdSet.has(conceptId);
}

export function isMultipleChoiceDrillItem(
  item: ConceptDrillItem,
): item is ConceptDrillItem & {
  options: [string, string, string, string];
  correctAnswerIndex: number;
} {
  return (
    Array.isArray(item.options) &&
    item.options.length === 4 &&
    item.options.every((option) => typeof option === "string" && option.trim()) &&
    typeof item.correctAnswerIndex === "number" &&
    item.correctAnswerIndex >= 0 &&
    item.correctAnswerIndex <= 3
  );
}

export function isMultipleChoiceDrillSet(items: ConceptDrillItem[]): boolean {
  return items.length > 0 && items.every(isMultipleChoiceDrillItem);
}

export const conceptMcDrillItemSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctAnswerIndex: z.number().int().min(0).max(3),
  hint: z.string().optional(),
});

export const conceptFreeformDrillItemSchema = z.object({
  prompt: z.string().min(1),
  hint: z.string().optional(),
  options: z.never().optional(),
  correctAnswerIndex: z.never().optional(),
});

export function getConceptDrillItemsArraySchema(conceptId?: string) {
  if (isMultipleChoiceConcept(conceptId)) {
    return z.array(conceptMcDrillItemSchema).min(8);
  }
  return z
    .array(
      z.union([conceptMcDrillItemSchema, conceptFreeformDrillItemSchema]),
    )
    .min(8);
}

function coerceAnswerIndex(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value >= 0 && value <= 3) return value;
    if (value >= 1 && value <= 4) return value - 1;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return coerceAnswerIndex(Number(value.trim()));
  }
  return undefined;
}

export function normalizeConceptDrillItems(
  items: unknown,
  conceptId?: string,
): ConceptDrillItem[] | undefined {
  if (!Array.isArray(items)) return undefined;

  const normalized = items
    .map((item): ConceptDrillItem | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const prompt =
        typeof record.prompt === "string" ? record.prompt.trim() : "";
      if (!prompt) return null;

      const hint =
        typeof record.hint === "string" && record.hint.trim()
          ? record.hint.trim()
          : undefined;

      const options = Array.isArray(record.options)
        ? record.options
            .filter((option): option is string => typeof option === "string")
            .map((option) => option.trim())
            .filter(Boolean)
        : undefined;

      const correctAnswerIndex = coerceAnswerIndex(record.correctAnswerIndex);

      if (options?.length === 4 && correctAnswerIndex != null) {
        return { prompt, options: options as [string, string, string, string], correctAnswerIndex, hint };
      }

      if (isMultipleChoiceConcept(conceptId)) {
        return null;
      }

      return { prompt, hint };
    })
    .filter((item): item is ConceptDrillItem => item != null);

  return normalized.length > 0 ? normalized : undefined;
}

export function computeConceptDrillScore(
  answers: Record<string, number>,
  items: ConceptDrillItem[],
): { correct: number; total: number; band: number; summary: string } {
  let correct = 0;
  items.forEach((item, index) => {
    if (!isMultipleChoiceDrillItem(item)) return;
    if (answers[String(index)] === item.correctAnswerIndex) correct++;
  });
  const total = items.length;
  const pct = total > 0 ? correct / total : 0;
  const band = Math.max(1, Math.min(12, Math.round(pct * 12)));
  return {
    correct,
    total,
    band,
    summary: `${correct}/${total} correct (${Math.round(pct * 100)}%)`,
  };
}

function defaultConceptDrillFeedback(
  isCorrect: boolean,
  item: ConceptDrillItem & {
    options: [string, string, string, string];
    correctAnswerIndex: number;
  },
  studentIndex?: number,
): string {
  const correctOption = item.options[item.correctAnswerIndex];
  if (isCorrect) {
    return `Correct. "${correctOption}" is the best answer.`;
  }
  const studentOption =
    studentIndex != null ? item.options[studentIndex] : undefined;
  if (studentOption) {
    return `Incorrect. The correct answer is "${correctOption}", not "${studentOption}".`;
  }
  return `Incorrect. The correct answer is "${correctOption}".`;
}

export function buildConceptDrillResults(
  answers: Record<string, number>,
  items: ConceptDrillItem[],
  aiResults?: ConceptDrillResult[],
  questionTimings?: Record<string, number>,
): ConceptDrillResult[] {
  return items.map((item, index) => {
    const studentIndex = answers[String(index)];
    const mcItem = isMultipleChoiceDrillItem(item) ? item : null;
    const isCorrect =
      mcItem != null && studentIndex === mcItem.correctAnswerIndex;
    const aiResult = aiResults?.find((result) => result.index === index);
    const timeSpentSeconds = questionTimings?.[String(index)];

    const studentAnswer =
      mcItem && studentIndex != null
        ? mcItem.options[studentIndex]
        : "(no answer selected)";
    const correctAnswer = mcItem
      ? mcItem.options[mcItem.correctAnswerIndex]
      : "";

    const feedback =
      aiResult?.feedback?.trim() ||
      (mcItem
        ? defaultConceptDrillFeedback(isCorrect, mcItem, studentIndex)
        : "Unable to grade this item.");

    return {
      index,
      isCorrect,
      studentAnswer,
      correctAnswer,
      feedback,
      ...(timeSpentSeconds != null && Number.isFinite(timeSpentSeconds)
        ? { timeSpentSeconds: Math.max(0, Math.round(timeSpentSeconds)) }
        : {}),
    };
  });
}

export function formatConceptDrillSubmission(
  items: ConceptDrillItem[],
  drillResponses: string[],
): {
  baseSubmission: string;
  drillBlock: string;
  isMcSet: boolean;
  mcAnswers: Record<string, number>;
} {
  const isMcSet = isMultipleChoiceDrillSet(items);
  const drillBlock = items
    .map((item, index) => {
      const response = drillResponses[index] ?? "";
      const displayAnswer =
        isMultipleChoiceDrillItem(item) && response !== ""
          ? (item.options[Number(response)] ?? response)
          : response;
      return `Q: ${item.prompt}\nA: ${displayAnswer}`;
    })
    .join("\n\n");
  const baseSubmission = `DRILL RESPONSES:\n${drillBlock}`;
  const mcAnswers = Object.fromEntries(
    drillResponses.map((response, index) => [String(index), Number(response)]),
  );

  return { baseSubmission, drillBlock, isMcSet, mcAnswers };
}

export function buildConceptGradeRequestBody(input: {
  conceptLabel: string;
  drillItems: ConceptDrillItem[];
  drillResponses: string[];
  model: string;
  gradingFeedbackConstraints?: string;
}) {
  const formatted = formatConceptDrillSubmission(
    input.drillItems,
    input.drillResponses,
  );

  return {
    focusSubTest: "Concept",
    examPrompt: "",
    studentSubmission: formatted.isMcSet
      ? formatted.mcAnswers
      : formatted.baseSubmission,
    conceptLabel: input.conceptLabel,
    conceptDrillItems: formatted.isMcSet ? input.drillItems : undefined,
    drillResponses: formatted.drillBlock,
    gradingFeedbackConstraints: input.gradingFeedbackConstraints,
    model: input.model,
  };
}

export function parseConceptMcAnswers(
  studentSubmission: string | Record<string, number>,
  drillResponsesText?: string,
): Record<string, number> {
  if (typeof studentSubmission === "object" && studentSubmission !== null) {
    const answers: Record<string, number> = {};
    for (const [key, value] of Object.entries(studentSubmission)) {
      if (typeof value === "number" && value >= 0 && value <= 3) {
        answers[key] = value;
      }
    }
    if (Object.keys(answers).length > 0) return answers;
  }

  if (!drillResponsesText) return {};

  const answers: Record<string, number> = {};
  const matches = [...drillResponsesText.matchAll(/^A: (.*)$/gm)];
  matches.forEach((match, index) => {
    const raw = match[1]?.trim() ?? "";
    const asIndex = Number(raw);
    if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex <= 3) {
      answers[String(index)] = asIndex;
    }
  });
  return answers;
}

export function restoreMcDrillResponse(
  item: ConceptDrillItem,
  savedAnswer: string,
): string {
  if (!isMultipleChoiceDrillItem(item)) return savedAnswer;

  const asIndex = Number(savedAnswer);
  if (
    Number.isInteger(asIndex) &&
    asIndex >= 0 &&
    asIndex < item.options.length
  ) {
    return String(asIndex);
  }

  const optionIndex = item.options.findIndex((option) => option === savedAnswer);
  return optionIndex >= 0 ? String(optionIndex) : savedAnswer;
}

export function formatConceptDrillItemsGenerationSpec(
  conceptId?: string,
): string {
  if (isMultipleChoiceConcept(conceptId)) {
    return `"conceptDrillItems": An array of exactly 8 objects, each with:
- "prompt": the question (use ___ for a blank in the sentence, or ask which option best completes/fixes/paraphrases it)
- "options": array of exactly 4 plausible answer strings — ONLY what goes in the blank; never repeat words that already appear in the prompt after ___
- "correctAnswerIndex": integer 0-3 (0 = first option)
- optional "hint"

CRITICAL: Every item MUST be multiple-choice with exactly 4 options. Do NOT use free-text fill-in-the-blank or one-sentence rewrites without options.
CRITICAL: All four options must produce different sentences when inserted at ___. Do not offer redundant options (e.g. "," vs ", however," when "however" already follows the blank).`;
  }

  return `"conceptDrillItems": An array of exactly 8 objects with "prompt" (fill-in-the-blank with a single word or short phrase, or a one-sentence rewrite) and optional "hint". Keep prompts concise; answers should be 1-3 words unless rewriting a full sentence.`;
}
