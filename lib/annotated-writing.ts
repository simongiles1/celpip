import { getConceptById, normalizeConceptId } from "@/lib/skill-profile";
import type {
  GrammarCorrection,
  SkillTag,
  UserSkillProfile,
} from "@/lib/types";

export interface WritingAnnotation {
  start: number;
  end: number;
  correction: GrammarCorrection;
  conceptId?: string;
  conceptLabel?: string;
}

export type AnnotatedSegment =
  | { type: "plain"; text: string }
  | { type: "annotation"; text: string; annotation: WritingAnnotation };

function normalizeForMatch(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

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

function tagMatchesCorrection(tag: SkillTag, correction: GrammarCorrection): boolean {
  const evidence = tag.evidence.trim();
  const original = correction.original.trim();
  if (!evidence || !original) return false;

  const evidenceNorm = normalizeForMatch(evidence);
  const originalNorm = normalizeForMatch(original);
  return (
    evidenceNorm.includes(originalNorm) ||
    originalNorm.includes(evidenceNorm) ||
    evidenceNorm === originalNorm
  );
}

export function enrichGrammarCorrections(
  corrections: GrammarCorrection[],
  skillTags: SkillTag[] | undefined,
  profile: UserSkillProfile,
): GrammarCorrection[] {
  const weaknessTags =
    skillTags?.filter((tag) => tag.polarity === "weakness") ?? [];

  return corrections.map((fix) => {
    if (fix.conceptId) return fix;

    const matchedTag = weaknessTags.find((tag) => tagMatchesCorrection(tag, fix));
    if (!matchedTag) return fix;

    const { conceptId } = normalizeConceptId(matchedTag, profile);
    return { ...fix, conceptId };
  });
}

export function buildWritingAnnotations(
  text: string,
  corrections: GrammarCorrection[],
  profile: UserSkillProfile,
): WritingAnnotation[] {
  const used: Array<[number, number]> = [];
  const sorted = [...corrections].sort(
    (a, b) => b.original.trim().length - a.original.trim().length,
  );
  const annotations: WritingAnnotation[] = [];

  for (const correction of sorted) {
    const span = findSpan(text, correction.original, used);
    if (!span) continue;

    used.push([span.start, span.end]);
    const conceptId = correction.conceptId?.replace(/^new:/, "");
    const concept = conceptId ? getConceptById(profile, conceptId) : undefined;

    annotations.push({
      ...span,
      correction,
      conceptId,
      conceptLabel: concept?.label,
    });
  }

  return annotations.sort((a, b) => a.start - b.start);
}

export function buildAnnotatedSegments(
  text: string,
  annotations: WritingAnnotation[],
): AnnotatedSegment[] {
  const segments: AnnotatedSegment[] = [];
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

export function prepareAnnotatedWriting(
  text: string,
  corrections: GrammarCorrection[],
  profile: UserSkillProfile,
  skillTags?: SkillTag[],
): {
  segments: AnnotatedSegment[];
  matchedCount: number;
  totalCorrections: number;
} {
  const enriched = enrichGrammarCorrections(corrections, skillTags, profile);
  const annotations = buildWritingAnnotations(text, enriched, profile);
  return {
    segments: buildAnnotatedSegments(text, annotations),
    matchedCount: annotations.length,
    totalCorrections: corrections.length,
  };
}
