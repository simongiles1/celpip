import { enrichGrammarCorrections } from "@/lib/annotated-writing";
import { getConceptById } from "@/lib/skill-profile";
import type {
  FocusHighlight,
  GrammarCorrection,
  SkillTag,
  UserSkillProfile,
} from "@/lib/types";

export type FocusSegmentKind =
  | "focus-correct"
  | "focus-mistake"
  | "other-mistake"
  | "plain";

export interface FocusAnnotation {
  start: number;
  end: number;
  kind: FocusSegmentKind;
  text: string;
  conceptId?: string;
  conceptLabel?: string;
  note?: string;
  correction?: GrammarCorrection;
}

export type FocusAnnotatedSegment =
  | { type: "plain"; text: string }
  | { type: "annotation"; text: string; annotation: FocusAnnotation };

function rangesOverlap(
  used: Array<[number, number]>,
  start: number,
  end: number,
): boolean {
  return used.some(([s, e]) => start < e && end > s);
}

function findSpan(
  text: string,
  phrase: string,
  used: Array<[number, number]>,
): { start: number; end: number } | null {
  const trimmed = phrase.trim();
  if (!trimmed) return null;

  const lowerText = text.toLowerCase();
  const lowerPhrase = trimmed.toLowerCase();
  let idx = 0;

  while (idx < text.length) {
    const pos = lowerText.indexOf(lowerPhrase, idx);
    if (pos === -1) break;
    const end = pos + trimmed.length;
    if (!rangesOverlap(used, pos, end)) {
      return { start: pos, end };
    }
    idx = pos + 1;
  }

  return null;
}

function isFocusConcept(
  conceptId: string | undefined,
  focusConceptIds: Set<string>,
): boolean {
  if (!conceptId) return false;
  return focusConceptIds.has(conceptId.replace(/^new:/, ""));
}

export function buildFocusAnnotations(
  text: string,
  params: {
    focusHighlights: FocusHighlight[];
    grammarCorrections: GrammarCorrection[];
    focusConceptIds: string[];
    profile: UserSkillProfile;
    skillTags?: SkillTag[];
  },
): FocusAnnotation[] {
  const focusSet = new Set(params.focusConceptIds);
  const used: Array<[number, number]> = [];
  const annotations: FocusAnnotation[] = [];

  const sortedHighlights = [...params.focusHighlights].sort(
    (a, b) => b.text.trim().length - a.text.trim().length,
  );

  for (const highlight of sortedHighlights) {
    const conceptId = highlight.conceptId.replace(/^new:/, "");
    if (!focusSet.has(conceptId)) continue;

    const span = findSpan(text, highlight.text, used);
    if (!span) continue;

    used.push([span.start, span.end]);
    const concept = getConceptById(params.profile, conceptId);
    annotations.push({
      ...span,
      kind:
        highlight.polarity === "correct" ? "focus-correct" : "focus-mistake",
      text: text.slice(span.start, span.end),
      conceptId,
      conceptLabel: concept?.label,
      note: highlight.note,
    });
  }

  const enriched = enrichGrammarCorrections(
    params.grammarCorrections,
    params.skillTags,
    params.profile,
  );

  const sortedCorrections = [...enriched].sort(
    (a, b) => b.original.trim().length - a.original.trim().length,
  );

  for (const correction of sortedCorrections) {
    const conceptId = correction.conceptId?.replace(/^new:/, "");
    const span = findSpan(text, correction.original, used);
    if (!span) continue;

    used.push([span.start, span.end]);
    const concept = conceptId
      ? getConceptById(params.profile, conceptId)
      : undefined;

    const kind: FocusSegmentKind = isFocusConcept(conceptId, focusSet)
      ? "focus-mistake"
      : "other-mistake";

    if (
      annotations.some(
        (a) =>
          a.start === span.start &&
          a.end === span.end &&
          a.kind === "focus-mistake",
      )
    ) {
      continue;
    }

    annotations.push({
      ...span,
      kind,
      text: text.slice(span.start, span.end),
      conceptId,
      conceptLabel: concept?.label,
      note: correction.reason,
      correction,
    });
  }

  return annotations.sort((a, b) => a.start - b.start);
}

export function buildFocusAnnotatedSegments(
  text: string,
  annotations: FocusAnnotation[],
): FocusAnnotatedSegment[] {
  const segments: FocusAnnotatedSegment[] = [];
  let cursor = 0;

  for (const annotation of annotations) {
    if (annotation.start < cursor) continue;
    if (annotation.start > cursor) {
      segments.push({
        type: "plain",
        text: text.slice(cursor, annotation.start),
      });
    }
    segments.push({
      type: "annotation",
      text: text.slice(annotation.start, annotation.end),
      annotation,
    });
    cursor = annotation.end;
  }

  if (cursor < text.length) {
    segments.push({ type: "plain", text: text.slice(cursor) });
  }

  return segments;
}

export function prepareFocusedWritingReview(
  text: string,
  params: {
    focusHighlights: FocusHighlight[];
    grammarCorrections: GrammarCorrection[];
    focusConceptIds: string[];
    profile: UserSkillProfile;
    skillTags?: SkillTag[];
  },
): {
  segments: FocusAnnotatedSegment[];
  matchedCount: number;
  focusCorrectCount: number;
  focusMistakeCount: number;
  otherMistakeCount: number;
} {
  const annotations = buildFocusAnnotations(text, params);
  const focusCorrectCount = annotations.filter(
    (a) => a.kind === "focus-correct",
  ).length;
  const focusMistakeCount = annotations.filter(
    (a) => a.kind === "focus-mistake",
  ).length;
  const otherMistakeCount = annotations.filter(
    (a) => a.kind === "other-mistake",
  ).length;

  return {
    segments: buildFocusAnnotatedSegments(text, annotations),
    matchedCount: annotations.length,
    focusCorrectCount,
    focusMistakeCount,
    otherMistakeCount,
  };
}
