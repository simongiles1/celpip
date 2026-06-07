import {
  coerceClbBand,
  normalizeCelpipPart,
  normalizeQuestionType,
} from "@/lib/normalize-generated-reading";
import { alignAiReadingFeedback } from "@/lib/reading-feedback-alignment";

const SKILL_CATEGORIES = new Set([
  "grammar",
  "vocabulary",
  "reading_strategy",
  "writing_structure",
]);

const SKILL_POLARITIES = new Set(["strength", "weakness"]);

function coerceInteger(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(min, Math.min(max, Math.round(value)));
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(min, Math.min(max, Math.round(parsed)));
    }
  }
  return undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function normalizeSkillCategory(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (SKILL_CATEGORIES.has(normalized)) return normalized;
  if (/reading|strategy|comprehension/.test(normalized)) {
    return "reading_strategy";
  }
  if (/writing|structure|organization/.test(normalized)) {
    return "writing_structure";
  }
  if (/grammar|syntax|mechanics/.test(normalized)) {
    return "grammar";
  }
  if (/vocab|lexical|word_choice/.test(normalized)) {
    return "vocabulary";
  }
  return undefined;
}

function normalizeSkillPolarity(value: unknown): "strength" | "weakness" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (SKILL_POLARITIES.has(normalized as "strength" | "weakness")) {
    return normalized as "strength" | "weakness";
  }
  if (/strength|positive|strong|good/.test(normalized)) return "strength";
  if (/weakness|negative|weak|improve|issue|error/.test(normalized)) {
    return "weakness";
  }
  return undefined;
}

function normalizeSkillTag(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const tag = raw as Record<string, unknown>;
  const conceptId =
    typeof tag.conceptId === "string" ? tag.conceptId.trim() : "";
  const polarity = normalizeSkillPolarity(tag.polarity);
  const evidence =
    typeof tag.evidence === "string" ? tag.evidence.trim() : "";
  if (!conceptId || !polarity || !evidence) return null;

  const normalized: Record<string, unknown> = {
    conceptId,
    polarity,
    evidence,
  };

  const label = typeof tag.label === "string" ? tag.label.trim() : "";
  if (label) normalized.label = label;

  const description =
    typeof tag.description === "string" ? tag.description.trim() : "";
  if (description) normalized.description = description;

  const category = normalizeSkillCategory(tag.category);
  if (category) normalized.category = category;

  return normalized;
}

function normalizeGrammarCorrection(
  raw: unknown,
): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const original =
    typeof item.original === "string" ? item.original.trim() : "";
  const corrected =
    typeof item.corrected === "string" ? item.corrected.trim() : "";
  const reason = typeof item.reason === "string" ? item.reason.trim() : "";
  if (!original && !corrected && !reason) return null;
  const normalized: Record<string, string> = { original, corrected, reason };
  const conceptId =
    typeof item.conceptId === "string" ? item.conceptId.trim() : "";
  if (conceptId) normalized.conceptId = conceptId;
  return normalized;
}

function normalizeDrillResult(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const index = coerceInteger(item.index, 0, 99);
  const feedback =
    typeof item.feedback === "string" ? item.feedback.trim() : "";
  if (index == null || !feedback) return null;

  return {
    index,
    isCorrect: Boolean(item.isCorrect),
    studentAnswer:
      typeof item.studentAnswer === "string" ? item.studentAnswer.trim() : "",
    correctAnswer:
      typeof item.correctAnswer === "string" ? item.correctAnswer.trim() : "",
    feedback,
  };
}

function normalizeReadingResult(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const index = coerceInteger(item.index, 0, 99);
  const feedback =
    typeof item.feedback === "string" ? item.feedback.trim() : "";
  if (index == null || !feedback) return null;

  const normalized: Record<string, unknown> = { index, feedback };

  const celpipPart = normalizeCelpipPart(item.celpipPart);
  if (celpipPart) normalized.celpipPart = celpipPart;

  const questionType = normalizeQuestionType(item.questionType);
  if (questionType) normalized.questionType = questionType;

  const targetClbBand = coerceClbBand(item.targetClbBand);
  if (targetClbBand != null) normalized.targetClbBand = targetClbBand;

  return normalized;
}

function normalizeWritingResult(
  raw: unknown,
): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const item = raw as Record<string, unknown>;
  const feedback =
    typeof item.feedback === "string" ? item.feedback.trim() : "";
  if (!feedback) return undefined;
  return {
    isAcceptable: Boolean(item.isAcceptable),
    feedback,
  };
}

/** Coerce common Gemini grading JSON quirks before Zod validation. */
export function normalizeGradingPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const root = parsed as Record<string, unknown>;
  const next: Record<string, unknown> = { ...root };

  const estimatedBand = coerceInteger(
    next.estimatedBand ?? next.band ?? next.clbBand ?? next.estimatedCLB,
    1,
    12,
  );
  if (estimatedBand != null) next.estimatedBand = estimatedBand;

  const overallFeedbackRaw =
    next.overallFeedback ?? next.feedback ?? next.summary;
  if (typeof overallFeedbackRaw === "string") {
    next.overallFeedback = overallFeedbackRaw.trim();
  } else if (overallFeedbackRaw != null) {
    next.overallFeedback = String(overallFeedbackRaw);
  }

  next.positives = asStringArray(next.positives ?? next.strengths);
  next.constructiveCriticism = asStringArray(
    next.constructiveCriticism ??
      next.improvements ??
      next.areasForImprovement,
  );

  if (!Array.isArray(next.grammarCorrections)) {
    next.grammarCorrections = [];
  } else {
    next.grammarCorrections = next.grammarCorrections
      .map((item) => normalizeGrammarCorrection(item))
      .filter((item): item is Record<string, string> => item != null);
  }

  if (Array.isArray(next.skillTags)) {
    next.skillTags = next.skillTags
      .map((item) => normalizeSkillTag(item))
      .filter((item): item is Record<string, unknown> => item != null);
  } else if (next.skillTags == null) {
    next.skillTags = [];
  }

  if (Array.isArray(next.drillResults)) {
    next.drillResults = next.drillResults
      .map((item) => normalizeDrillResult(item))
      .filter((item): item is Record<string, unknown> => item != null);
  }

  if (Array.isArray(next.readingResults)) {
    const normalized = next.readingResults
      .map((item) => normalizeReadingResult(item))
      .filter((item): item is Record<string, unknown> => item != null);
    next.readingResults =
      alignAiReadingFeedback(
        normalized.map((item) => ({
          index: Number(item.index),
          feedback: String(item.feedback),
        })),
        normalized.length,
      ) ?? normalized;
  }

  const writingResult = normalizeWritingResult(next.writingResult);
  if (writingResult) next.writingResult = writingResult;
  else delete next.writingResult;

  if (Array.isArray(next.focusHighlights)) {
    next.focusHighlights = next.focusHighlights
      .map((item) => normalizeFocusHighlight(item))
      .filter((item): item is Record<string, unknown> => item != null);
  } else if (next.focusHighlights == null) {
    next.focusHighlights = [];
  }

  if (Array.isArray(next.focusRankings)) {
    next.focusRankings = next.focusRankings
      .map((item) => normalizeFocusRank(item))
      .filter((item): item is Record<string, unknown> => item != null);
  } else if (next.focusRankings == null) {
    next.focusRankings = [];
  }

  return next;
}

function normalizeFocusHighlight(
  raw: unknown,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const text = typeof item.text === "string" ? item.text.trim() : "";
  const conceptId =
    typeof item.conceptId === "string" ? item.conceptId.trim() : "";
  const note = typeof item.note === "string" ? item.note.trim() : "";
  const polarityRaw =
    typeof item.polarity === "string" ? item.polarity.trim().toLowerCase() : "";
  const polarity =
    polarityRaw === "correct" || polarityRaw === "mistake"
      ? polarityRaw
      : undefined;
  if (!text || !conceptId || !polarity) return null;
  return { text, conceptId, polarity, note: note || "Focus concept usage." };
}

function normalizeFocusRank(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const conceptId =
    typeof item.conceptId === "string" ? item.conceptId.trim() : "";
  const rationale =
    typeof item.rationale === "string" ? item.rationale.trim() : "";
  const impact = coerceInteger(item.estimatedScoreImpact, 1, 5);
  const effort = coerceInteger(item.estimatedEffort, 1, 5);
  if (!conceptId || !rationale || impact == null || effort == null) return null;
  return {
    conceptId,
    estimatedScoreImpact: impact,
    estimatedEffort: effort,
    rationale,
  };
}
