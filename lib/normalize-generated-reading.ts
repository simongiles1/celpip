import { normalizeExamPromptMarkdown } from "@/lib/normalize-exam-prompt-markdown";
import type { CelpipReadingPart, ReadingQuestionType } from "@/lib/types";

const CELPIP_PARTS = new Set<CelpipReadingPart>([
  "part_1",
  "part_2",
  "part_3",
  "part_4",
]);

const QUESTION_TYPES = new Set<ReadingQuestionType>([
  "main_idea",
  "detail_extraction",
  "inference",
  "paraphrase_recognition",
  "vocabulary_in_context",
  "distractor_analysis",
  "tone_attitude",
]);

export function coerceClbBand(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(6, Math.min(12, Math.round(value)));
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(6, Math.min(12, Math.round(parsed)));
    }
  }
  return undefined;
}

function parseRawAnswerIndex(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return undefined;
}

/** Detect whether the model used 0-3 (API contract) or 1-4 (legacy). */
function detectAnswerIndexConvention(rawIndices: number[]): "zero-based" | "one-based" {
  if (rawIndices.some((index) => index === 0)) return "zero-based";
  if (rawIndices.some((index) => index === 4)) return "one-based";
  // Prompt requires 0-3; default to that when ambiguous (e.g. only 1-3 present).
  return "zero-based";
}

function coerceAnswerIndex(
  value: unknown,
  convention: "zero-based" | "one-based",
): number | undefined {
  const index = parseRawAnswerIndex(value);
  if (index == null) return undefined;

  if (convention === "one-based") {
    if (index >= 1 && index <= 4) return index - 1;
    if (index >= 0 && index <= 3) return index;
    return undefined;
  }

  if (index >= 0 && index <= 3) return index;
  if (index === 4) return 3;
  return undefined;
}

export function normalizeCelpipPart(value: unknown): CelpipReadingPart | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/^part(\d)$/, "part_$1");
  if (CELPIP_PARTS.has(normalized as CelpipReadingPart)) {
    return normalized as CelpipReadingPart;
  }
  const match = normalized.match(/part[_\s-]?([1-4])/);
  if (match) return `part_${match[1]}` as CelpipReadingPart;
  return undefined;
}

export function normalizeQuestionType(
  value: unknown,
): ReadingQuestionType | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (QUESTION_TYPES.has(normalized as ReadingQuestionType)) {
    return normalized as ReadingQuestionType;
  }
  if (/vocab/.test(normalized)) return "vocabulary_in_context";
  if (/paraphrase|synonym/.test(normalized)) return "paraphrase_recognition";
  if (/main_?idea|gist/.test(normalized)) return "main_idea";
  if (/detail|explicit/.test(normalized)) return "detail_extraction";
  if (/infer|implied/.test(normalized)) return "inference";
  if (/tone|attitude|intent/.test(normalized)) return "tone_attitude";
  if (/distractor/.test(normalized)) return "distractor_analysis";
  return undefined;
}

function normalizeOptions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const options = value
    .map((option) => (typeof option === "string" ? option.trim() : String(option ?? "").trim()))
    .filter(Boolean);
  if (options.length < 4) return undefined;
  return options.slice(0, 4);
}

function normalizeReadingQuestion(
  raw: unknown,
  convention: "zero-based" | "one-based",
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const question = raw as Record<string, unknown>;
  const prompt = typeof question.question === "string" ? question.question.trim() : "";
  const options = normalizeOptions(question.options);
  const correctAnswerIndex = coerceAnswerIndex(
    question.correctAnswerIndex,
    convention,
  );
  if (!prompt || !options || correctAnswerIndex == null) return null;

  const normalized: Record<string, unknown> = {
    question: prompt,
    options,
    correctAnswerIndex,
  };

  const celpipPart = normalizeCelpipPart(question.celpipPart);
  if (celpipPart) normalized.celpipPart = celpipPart;

  const questionType = normalizeQuestionType(question.questionType);
  if (questionType) normalized.questionType = questionType;

  const targetClbBand = coerceClbBand(question.targetClbBand);
  if (targetClbBand != null) normalized.targetClbBand = targetClbBand;

  return normalized;
}

/** Coerce common Gemini reading JSON quirks before Zod validation. */
export function normalizeGeneratedReadingPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const root = parsed as Record<string, unknown>;
  const next: Record<string, unknown> = { ...root };

  if (typeof next.examPrompt === "string") {
    next.examPrompt = normalizeExamPromptMarkdown(next.examPrompt);
  }

  if (typeof next.instructions === "string") {
    next.instructions = normalizeExamPromptMarkdown(next.instructions);
  }

  if (typeof next.example === "string") {
    next.example = normalizeExamPromptMarkdown(next.example);
  }

  const passageCelpipPart = normalizeCelpipPart(next.passageCelpipPart);
  if (passageCelpipPart) next.passageCelpipPart = passageCelpipPart;
  else delete next.passageCelpipPart;

  const passageTargetClbBand = coerceClbBand(next.passageTargetClbBand);
  if (passageTargetClbBand != null) {
    next.passageTargetClbBand = passageTargetClbBand;
  } else {
    delete next.passageTargetClbBand;
  }

  if (Array.isArray(next.readingQuestions)) {
    const rawIndices = next.readingQuestions
      .map((question) =>
        question && typeof question === "object"
          ? parseRawAnswerIndex(
              (question as Record<string, unknown>).correctAnswerIndex,
            )
          : undefined,
      )
      .filter((index): index is number => index != null);
    const convention = detectAnswerIndexConvention(rawIndices);

    next.readingQuestions = next.readingQuestions
      .map((question) => normalizeReadingQuestion(question, convention))
      .filter((question): question is Record<string, unknown> => question != null);
  }

  return next;
}
