import { z } from "zod";
import type {
  ConceptDrillItem,
  ConceptDrillResult,
  ConceptQuestionCheckResponse,
} from "@/lib/types";

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
  acceptableAnswerIndexes: z
    .array(z.number().int().min(0).max(3))
    .min(1)
    .max(4),
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

function coerceAnswerIndexes(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const indexes = value
    .map((entry) => coerceAnswerIndex(entry))
    .filter((entry): entry is number => entry != null);
  if (indexes.length === 0) return undefined;
  return [...new Set(indexes)].sort((a, b) => a - b);
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
      const acceptableAnswerIndexes = coerceAnswerIndexes(
        record.acceptableAnswerIndexes,
      );

      if (options?.length === 4 && correctAnswerIndex != null) {
        const normalizedAcceptable = acceptableAnswerIndexes?.length
          ? [
              ...new Set([
                correctAnswerIndex,
                ...acceptableAnswerIndexes.filter(
                  (index) => index >= 0 && index <= 3,
                ),
              ]),
            ].sort((a, b) => a - b)
          : undefined;

        return {
          prompt,
          options: options as [string, string, string, string],
          correctAnswerIndex,
          ...(normalizedAcceptable
            ? { acceptableAnswerIndexes: normalizedAcceptable }
            : {}),
          hint,
        };
      }

      if (isMultipleChoiceConcept(conceptId)) {
        return null;
      }

      return { prompt, hint };
    })
    .filter((item): item is ConceptDrillItem => item != null);

  return normalized.length > 0 ? normalized : undefined;
}

export function parseMcDrillSelectedIndexes(response: string): number[] {
  if (!response.trim()) return [];

  if (response.includes(",")) {
    return [...new Set(
      response
        .split(",")
        .map((part) => Number(part.trim()))
        .filter(
          (index) => Number.isInteger(index) && index >= 0 && index <= 3,
        ),
    )].sort((a, b) => a - b);
  }

  const single = Number(response);
  if (Number.isInteger(single) && single >= 0 && single <= 3) {
    return [single];
  }

  return [];
}

export function serializeMcDrillSelectedIndexes(indexes: number[]): string {
  return [...new Set(indexes)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index <= 3)
    .sort((a, b) => a - b)
    .join(",");
}

export function getAcceptableAnswerIndexes(
  item: ConceptDrillItem,
  overlay?: number[],
): number[] {
  if (overlay?.length) {
    return [...new Set(overlay)].sort((a, b) => a - b);
  }
  if (!isMultipleChoiceDrillItem(item)) return [];
  if (item.acceptableAnswerIndexes != null) {
    return [...new Set(item.acceptableAnswerIndexes)].sort((a, b) => a - b);
  }
  return [item.correctAnswerIndex];
}

export function isMultiSelectMcDrillItem(
  item: ConceptDrillItem,
  acceptableIndexes?: number[],
): boolean {
  if (!isMultipleChoiceDrillItem(item)) return false;
  return getAcceptableAnswerIndexes(item, acceptableIndexes).length > 1;
}

export function isMcDrillSelectionCorrect(
  selected: number[],
  acceptable: number[],
): boolean {
  if (selected.length === 0 || acceptable.length === 0) return false;
  return selected.every((index) => acceptable.includes(index));
}

export function toggleMcDrillSelection(
  currentResponse: string,
  optionIndex: number,
  multiSelect: boolean,
): string {
  if (!multiSelect) return String(optionIndex);

  const selected = parseMcDrillSelectedIndexes(currentResponse);
  const next = selected.includes(optionIndex)
    ? selected.filter((index) => index !== optionIndex)
    : [...selected, optionIndex];
  return serializeMcDrillSelectedIndexes(next);
}

export function formatMcStudentAnswerDisplay(
  item: ConceptDrillItem,
  response: string,
): string {
  if (!isMultipleChoiceDrillItem(item) || !response) return response;

  const selected = parseMcDrillSelectedIndexes(response);
  if (selected.length === 0) return response;

  return selected.map((index) => item.options[index] ?? String(index)).join(", ");
}

export function isMcDrillResponseComplete(
  item: ConceptDrillItem,
  response: string | undefined,
  acceptableIndexes?: number[],
): boolean {
  if (!isMultipleChoiceDrillItem(item)) return false;
  const selected = parseMcDrillSelectedIndexes(response ?? "");
  return selected.length > 0;
}

export function computeConceptDrillScore(
  answers: Record<string, number | number[] | string>,
  items: ConceptDrillItem[],
): { correct: number; total: number; band: number; summary: string } {
  let correct = 0;
  items.forEach((item, index) => {
    if (!isMultipleChoiceDrillItem(item)) return;
    const raw = answers[String(index)];
    const response =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? serializeMcDrillSelectedIndexes(raw)
          : raw != null
            ? String(raw)
            : "";
    const selected = parseMcDrillSelectedIndexes(response);
    const acceptable = getAcceptableAnswerIndexes(item);
    if (isMcDrillSelectionCorrect(selected, acceptable)) correct++;
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

export interface ConceptMcAiDrillFeedback {
  index: number;
  feedback: string;
  isAcceptable?: boolean;
}

export function mapMcAiDrillFeedback(
  aiResults?: ConceptMcAiDrillFeedback[],
): ConceptDrillResult[] | undefined {
  return aiResults?.map((item) => ({
    index: item.index,
    isCorrect: false,
    studentAnswer: "",
    correctAnswer: "",
    feedback: item.feedback,
    isAcceptable: item.isAcceptable,
  }));
}

function normalizeMcAnswerValue(
  value: number | number[] | string | undefined,
): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return serializeMcDrillSelectedIndexes(value);
  return String(value);
}

export function buildConceptDrillResults(
  answers: Record<string, number | number[] | string>,
  items: ConceptDrillItem[],
  aiResults?: Array<ConceptDrillResult & { isAcceptable?: boolean }>,
  questionTimings?: Record<string, number>,
): ConceptDrillResult[] {
  return items.map((item, index) => {
    const response = normalizeMcAnswerValue(answers[String(index)]);
    const selected = parseMcDrillSelectedIndexes(response);
    const mcItem = isMultipleChoiceDrillItem(item) ? item : null;
    const aiResult = aiResults?.find((result) => result.index === index);
    const acceptable = mcItem ? getAcceptableAnswerIndexes(mcItem) : [];
    const isCorrect =
      mcItem != null &&
      (isMcDrillSelectionCorrect(selected, acceptable) ||
        aiResult?.isAcceptable === true);
    const timeSpentSeconds = questionTimings?.[String(index)];

    const studentAnswer =
      mcItem && selected.length > 0
        ? formatMcStudentAnswerDisplay(mcItem, response)
        : "(no answer selected)";
    const correctAnswer = mcItem
      ? acceptable.map((optionIndex) => mcItem.options[optionIndex]).join(", ")
      : "";

    const feedback =
      aiResult?.feedback?.trim() ||
      (mcItem
        ? defaultConceptDrillFeedback(
            isCorrect,
            mcItem,
            selected.length === 1 ? selected[0] : undefined,
          )
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
      const displayAnswer = isMultipleChoiceDrillItem(item)
        ? formatMcStudentAnswerDisplay(item, response)
        : response;
      return `Q: ${item.prompt}\nA: ${displayAnswer}`;
    })
    .join("\n\n");
  const baseSubmission = `DRILL RESPONSES:\n${drillBlock}`;
  const mcAnswers = Object.fromEntries(
    drillResponses.map((response, index) => {
      const item = items[index];
      if (isMultipleChoiceDrillItem(item) && isMultiSelectMcDrillItem(item)) {
        return [String(index), response];
      }
      const selected = parseMcDrillSelectedIndexes(response);
      return [String(index), selected[0] ?? Number(response)];
    }),
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

export function getMcDrillResponseFromCheckInput(
  studentSubmission: string | Record<string, number | string>,
): string {
  if (typeof studentSubmission !== "object" || studentSubmission === null) {
    return "";
  }

  const raw = studentSubmission["0"];
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "string") return raw;
  return "";
}

export function parseConceptCheckStreamText(text: string): {
  isCorrect: boolean;
  hint?: string;
} {
  const trimmed = text.trim();
  if (/^CORRECT\.?$/i.test(trimmed)) {
    return { isCorrect: true };
  }
  return { isCorrect: false, hint: trimmed || undefined };
}

export function getConceptQuestionStudentAnswer(
  item: ConceptDrillItem,
  response: string,
): string {
  if (isMultipleChoiceDrillItem(item) && response !== "") {
    return formatMcStudentAnswerDisplay(item, response);
  }
  return response.trim();
}

export function isConceptQuestionCorrect(
  item: ConceptDrillItem,
  response: string,
  acceptableIndexes?: number[],
): boolean | null {
  if (!isMultipleChoiceDrillItem(item)) {
    return response.trim() ? null : null;
  }

  const selected = parseMcDrillSelectedIndexes(response);
  if (selected.length === 0) return null;

  const acceptable = getAcceptableAnswerIndexes(item, acceptableIndexes);
  return isMcDrillSelectionCorrect(selected, acceptable);
}

export function mergeAcceptableAnswerIndexes(
  current: number[],
  discovered?: number[],
): number[] {
  const merged = [...current, ...(discovered ?? [])];
  return [...new Set(merged)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index <= 3)
    .sort((a, b) => a - b);
}

export function buildInitialAcceptableIndexesByQuestion(
  items: ConceptDrillItem[],
): Record<number, number[]> {
  return Object.fromEntries(
    items.map((item, index) => [index, getAcceptableAnswerIndexes(item)]),
  );
}

export function needsConceptDrillAcceptabilityAnnotation(
  items: ConceptDrillItem[],
): boolean {
  return items.some(
    (item) =>
      isMultipleChoiceDrillItem(item) &&
      item.acceptableAnswerIndexes == null,
  );
}

export function applyAcceptableIndexesToDrillItems(
  items: ConceptDrillItem[],
  indexesByQuestion: Record<number, number[]>,
): ConceptDrillItem[] {
  return items.map((item, index) => {
    const acceptable = indexesByQuestion[index];
    if (!isMultipleChoiceDrillItem(item) || acceptable == null) {
      return item;
    }
    return { ...item, acceptableAnswerIndexes: acceptable };
  });
}

export function mergeAnnotatedAcceptableIndexes(
  items: ConceptDrillItem[],
  annotated: Array<{ index: number; acceptableAnswerIndexes: number[] }>,
): Record<number, number[]> {
  const map = buildInitialAcceptableIndexesByQuestion(items);
  for (const entry of annotated) {
    const item = items[entry.index];
    if (!item || item.acceptableAnswerIndexes != null) continue;
    if (entry.acceptableAnswerIndexes.length > 0) {
      map[entry.index] = [...new Set(entry.acceptableAnswerIndexes)].sort(
        (a, b) => a - b,
      );
    }
  }
  return map;
}

export function buildConceptDrillAnnotateRequestBody(input: {
  conceptLabel: string;
  drillItems: ConceptDrillItem[];
  model: string;
}) {
  const mcItems = input.drillItems.filter(isMultipleChoiceDrillItem);
  return {
    focusSubTest: "Concept" as const,
    examPrompt: "",
    studentSubmission: "",
    conceptLabel: input.conceptLabel,
    conceptDrillItems: mcItems,
    conceptGradingPhase: "annotate" as const,
    model: input.model,
  };
}

export function enrichConceptDrillItemsWithAcceptableIndexes(
  items: ConceptDrillItem[],
  acceptableIndexesByQuestion: Record<number, number[]>,
): ConceptDrillItem[] {
  return items.map((item, index) => {
    const overlay = acceptableIndexesByQuestion[index];
    if (!overlay?.length || !isMultipleChoiceDrillItem(item)) {
      return item;
    }
    return { ...item, acceptableAnswerIndexes: overlay };
  });
}

export function buildConceptQuestionGradeRequestBody(input: {
  conceptLabel: string;
  drillItems: ConceptDrillItem[];
  drillResponses: string[];
  questionIndex: number;
  model: string;
  gradingFeedbackConstraints?: string;
  phase: "check" | "full";
}) {
  const item = input.drillItems[input.questionIndex];
  if (!item) {
    throw new Error(`Question index ${input.questionIndex} is out of range`);
  }

  const response = input.drillResponses[input.questionIndex] ?? "";
  const studentAnswer = getConceptQuestionStudentAnswer(item, response);
  const singleItems = [item];
  const singleResponses = [response];
  const formatted = formatConceptDrillSubmission(singleItems, singleResponses);
  const knownIncorrect = isConceptQuestionCorrect(item, response) === false;

  return {
    focusSubTest: "Concept" as const,
    examPrompt: "",
    studentSubmission: formatted.isMcSet
      ? { "0": formatted.mcAnswers["0"] }
      : `DRILL RESPONSES:\nQ: ${item.prompt}\nA: ${studentAnswer}`,
    conceptLabel: input.conceptLabel,
    conceptDrillItems: formatted.isMcSet ? singleItems : undefined,
    drillResponses: formatted.drillBlock,
    gradingFeedbackConstraints: input.gradingFeedbackConstraints,
    conceptQuestionIndex: input.questionIndex,
    conceptGradingPhase: input.phase,
    conceptQuestionStudentAnswer: studentAnswer,
    conceptQuestionKnownIncorrect: knownIncorrect,
    model: input.model,
  };
}

export function parseConceptMcAnswers(
  studentSubmission: string | Record<string, number | string>,
  drillResponsesText?: string,
): Record<string, number | string> {
  if (typeof studentSubmission === "object" && studentSubmission !== null) {
    const answers: Record<string, number | string> = {};
    for (const [key, value] of Object.entries(studentSubmission)) {
      if (typeof value === "number" && value >= 0 && value <= 3) {
        answers[key] = value;
      } else if (typeof value === "string" && value.trim()) {
        answers[key] = value;
      }
    }
    if (Object.keys(answers).length > 0) return answers;
  }

  if (!drillResponsesText) return {};

  const answers: Record<string, number | string> = {};
  const matches = [...drillResponsesText.matchAll(/^A: (.*)$/gm)];
  matches.forEach((match, index) => {
    const raw = match[1]?.trim() ?? "";
    if (!raw) return;
    const asIndex = Number(raw);
    if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex <= 3) {
      answers[String(index)] = asIndex;
      return;
    }
    answers[String(index)] = raw;
  });
  return answers;
}

export function restoreMcDrillResponse(
  item: ConceptDrillItem,
  savedAnswer: string,
): string {
  if (!isMultipleChoiceDrillItem(item)) return savedAnswer;

  if (savedAnswer.includes(",")) {
    const selected = parseMcDrillSelectedIndexes(savedAnswer);
    if (selected.length > 0) return serializeMcDrillSelectedIndexes(selected);
  }

  const asIndex = Number(savedAnswer);
  if (
    Number.isInteger(asIndex) &&
    asIndex >= 0 &&
    asIndex < item.options.length
  ) {
    return String(asIndex);
  }

  if (savedAnswer.includes(",")) {
    const indexes = savedAnswer
      .split(",")
      .map((part) => item.options.findIndex((option) => option.trim() === part.trim()))
      .filter((index) => index >= 0);
    if (indexes.length > 0) {
      return serializeMcDrillSelectedIndexes(indexes);
    }
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
- "correctAnswerIndex": integer 0-3 (0 = first option) — the preferred answer
- "acceptableAnswerIndexes": REQUIRED on every item — array of every option index (0-3) that correctly completes the sentence; must include correctAnswerIndex; when length > 1, prompt must start with "Select all that could correctly complete the sentence:"
- optional "hint"

CRITICAL: Every item MUST be multiple-choice with exactly 4 options. Do NOT use free-text fill-in-the-blank or one-sentence rewrites without options.
CRITICAL: All four options must produce different sentences when inserted at ___. Do not offer redundant options (e.g. "," vs ", however," when "however" already follows the blank).
CRITICAL: Default to single-answer items. Use acceptableAnswerIndexes only when 2+ options are truly defensible — then the learner will see multi-select checkboxes.`;
  }

  return `"conceptDrillItems": An array of exactly 8 objects with "prompt" (fill-in-the-blank with a single word or short phrase, or a one-sentence rewrite) and optional "hint". Keep prompts concise; answers should be 1-3 words unless rewriting a full sentence.`;
}

export interface ConceptQuestionCheckStreamHandlers {
  onHint?: (hint: string) => void;
}

type ConceptQuestionCheckStreamEvent =
  | { type: "hint"; hint: string }
  | {
      type: "done";
      result: ConceptQuestionCheckResponse;
      geminiUsage?: ConceptQuestionCheckResponse["geminiUsage"];
    }
  | { type: "error"; error: string };

function processConceptQuestionCheckStreamLine(
  line: string,
  handlers: ConceptQuestionCheckStreamHandlers,
): ConceptQuestionCheckResponse | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const event = JSON.parse(trimmed) as ConceptQuestionCheckStreamEvent;
  if (event.type === "hint") {
    handlers.onHint?.(event.hint);
    return null;
  }
  if (event.type === "error") {
    throw new Error(event.error);
  }
  if (event.type === "done") {
    return {
      ...event.result,
      geminiUsage: event.geminiUsage,
    };
  }
  return null;
}

export async function fetchConceptQuestionCheck(
  body: Record<string, unknown>,
  handlers: ConceptQuestionCheckStreamHandlers = {},
): Promise<ConceptQuestionCheckResponse> {
  const res = await fetch("/api/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Check failed");
  }

  if (!res.body) {
    throw new Error("Check failed: empty response");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ConceptQuestionCheckResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const parsed = processConceptQuestionCheckStreamLine(line, handlers);
      if (parsed) result = parsed;
    }
  }

  if (buffer.trim()) {
    const parsed = processConceptQuestionCheckStreamLine(buffer, handlers);
    if (parsed) result = parsed;
  }

  if (!result) {
    throw new Error("Check failed: stream ended without a result");
  }

  return result;
}
