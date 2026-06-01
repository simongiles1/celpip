import { CONCEPT_SEED, getSeedConcept } from "@/data/concept-seed";
import {
  computeWritingConceptStats,
  writingConceptStatsEqual,
} from "@/lib/writing-analytics";
import type {
  GradedSession,
  ConceptCategory,
  ConceptDefinition,
  ConceptTrend,
  SkillObservation,
  SkillTag,
  UserConceptScore,
  UserSkillProfile,
} from "@/lib/types";

const MAX_DISCOVERED = 30;
const DISCOVERY_THRESHOLD = 2;

export function emptySkillProfile(): UserSkillProfile {
  return {
    observations: [],
    conceptScores: [],
    discoveredConcepts: [],
    writingConceptStats: {},
  };
}

export function withWritingConceptFrequency(
  profile: UserSkillProfile,
  graded: GradedSession[],
): UserSkillProfile {
  const writingConceptStats = computeWritingConceptStats(profile, graded);
  if (writingConceptStatsEqual(profile.writingConceptStats, writingConceptStats)) {
    return profile;
  }
  const { writingConceptFrequency: _legacy, ...rest } = profile;
  return { ...rest, writingConceptStats };
}

export function slugifyConceptId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

function slugify(text: string): string {
  return slugifyConceptId(text);
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

export function getAllConcepts(profile: UserSkillProfile): ConceptDefinition[] {
  return [...CONCEPT_SEED, ...profile.discoveredConcepts];
}

function findConceptByLabel(
  profile: UserSkillProfile,
  label: string,
): ConceptDefinition | undefined {
  const labelNorm = normalizeText(label);
  return getAllConcepts(profile).find(
    (c) => normalizeText(c.label) === labelNorm,
  );
}

export function addDiscoveredConcept(
  profile: UserSkillProfile,
  input: Omit<ConceptDefinition, "source">,
): { profile: UserSkillProfile; added: boolean; error?: string } {
  if (profile.discoveredConcepts.length >= MAX_DISCOVERED) {
    return {
      profile,
      added: false,
      error: `You already have ${MAX_DISCOVERED} custom concepts. Remove one before adding another.`,
    };
  }

  const id = input.id || slugifyConceptId(input.label);
  if (!id) {
    return { profile, added: false, error: "Concept label is too short." };
  }

  if (getSeedConcept(id) || getConceptById(profile, id)) {
    return {
      profile,
      added: false,
      error: "A concept with this id or name already exists.",
    };
  }

  const byLabel = findConceptByLabel(profile, input.label);
  if (byLabel) {
    return {
      profile,
      added: false,
      error: `"${byLabel.label}" already covers this topic.`,
    };
  }

  const concept: ConceptDefinition = {
    ...input,
    id,
    source: "discovered",
  };

  return {
    profile: {
      ...profile,
      discoveredConcepts: [...profile.discoveredConcepts, concept],
    },
    added: true,
  };
}

export function getConceptById(
  profile: UserSkillProfile,
  conceptId: string,
): ConceptDefinition | undefined {
  return getAllConcepts(profile).find((c) => c.id === conceptId);
}

export function normalizeConceptId(
  tag: SkillTag,
  profile: UserSkillProfile,
): { conceptId: string; isNew: boolean } {
  const rawId = tag.conceptId.replace(/^new:/, "");
  const seed = getSeedConcept(rawId);
  if (seed) return { conceptId: seed.id, isNew: false };

  const all = getAllConcepts(profile);
  const byId = all.find((c) => c.id === rawId);
  if (byId) return { conceptId: byId.id, isNew: false };

  const evidenceNorm = normalizeText(tag.evidence);
  const labelNorm = tag.label ? normalizeText(tag.label) : "";

  for (const concept of all) {
    if (labelNorm && normalizeText(concept.label) === labelNorm) {
      return { conceptId: concept.id, isNew: false };
    }
    for (const alias of concept.aliases ?? []) {
      if (evidenceNorm.includes(normalizeText(alias))) {
        return { conceptId: concept.id, isNew: false };
      }
    }
  }

  if (labelNorm) {
    for (const concept of all) {
      if (
        labelNorm.includes(normalizeText(concept.label)) ||
        normalizeText(concept.label).includes(labelNorm)
      ) {
        return { conceptId: concept.id, isNew: false };
      }
    }
  }

  const newId = rawId.startsWith("new:") ? slugify(rawId.slice(4)) : slugify(rawId || tag.label || "unknown");
  return { conceptId: newId || `discovered_${Date.now()}`, isNew: true };
}

function computeTrend(
  observations: SkillObservation[],
  conceptId: string,
): ConceptTrend {
  const recent = observations
    .filter((o) => o.conceptId === conceptId)
    .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
    .slice(0, 4);

  if (recent.length < 2) return "stable";

  const recentWeak = recent.filter((o) => o.polarity === "weakness").length;
  const older = observations
    .filter((o) => o.conceptId === conceptId)
    .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
    .slice(4, 8);
  const olderWeak = older.filter((o) => o.polarity === "weakness").length;

  if (recentWeak < olderWeak) return "improving";
  if (recentWeak > olderWeak) return "declining";
  return "stable";
}

function computeMastery(
  strengthCount: number,
  weaknessCount: number,
  trend: ConceptTrend,
): number {
  let bonus = 0;
  if (trend === "improving") bonus = 10;
  if (trend === "declining") bonus = -10;
  const raw = 50 + strengthCount * 8 - weaknessCount * 12 + bonus;
  return Math.max(0, Math.min(100, raw));
}

function recomputeScores(profile: UserSkillProfile): UserConceptScore[] {
  const byConcept = new Map<string, { strengths: number; weaknesses: number; lastAt: string }>();

  for (const obs of profile.observations) {
    const entry = byConcept.get(obs.conceptId) ?? {
      strengths: 0,
      weaknesses: 0,
      lastAt: obs.observedAt,
    };
    if (obs.polarity === "strength") entry.strengths++;
    else entry.weaknesses++;
    if (new Date(obs.observedAt) > new Date(entry.lastAt)) {
      entry.lastAt = obs.observedAt;
    }
    byConcept.set(obs.conceptId, entry);
  }

  return Array.from(byConcept.entries()).map(([conceptId, counts]) => {
    const trend = computeTrend(profile.observations, conceptId);
    return {
      conceptId,
      weaknessCount: counts.weaknesses,
      strengthCount: counts.strengths,
      lastObservedAt: counts.lastAt,
      trend,
      mastery: computeMastery(counts.strengths, counts.weaknesses, trend),
    };
  });
}

function maybePromoteDiscoveredConcepts(
  profile: UserSkillProfile,
  tags: SkillTag[],
): ConceptDefinition[] {
  const discovered = [...profile.discoveredConcepts];
  const tentativeCounts = new Map<string, { tag: SkillTag; count: number }>();

  for (const tag of tags) {
    const { conceptId, isNew } = normalizeConceptId(tag, profile);
    if (!isNew) continue;
    if (getConceptById(profile, conceptId)) continue;

    const key = tag.label ? normalizeText(tag.label) : conceptId;
    const existing = tentativeCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      tentativeCounts.set(key, { tag, count: 1 });
    }
  }

  for (const [, { tag, count }] of tentativeCounts) {
    const threshold =
      tag.polarity === "weakness" ? 1 : DISCOVERY_THRESHOLD;
    if (count < threshold) continue;
    if (discovered.length >= MAX_DISCOVERED) break;

    const { conceptId } = normalizeConceptId(tag, profile);
    if (discovered.some((d) => d.id === conceptId) || getSeedConcept(conceptId)) continue;

    discovered.push({
      id: conceptId,
      label: tag.label ?? conceptId.replace(/_/g, " "),
      category: (tag.category ?? "grammar") as ConceptCategory,
      description: tag.description ?? tag.evidence,
      source: "discovered",
      aliases: tag.label ? [tag.label] : undefined,
    });
  }

  return discovered;
}

export function applySkillTags(
  profile: UserSkillProfile,
  params: {
    eventId: string;
    track: "subtest" | "concept";
    band?: number;
    tags: SkillTag[];
  },
): UserSkillProfile {
  const withoutEvent = profile.observations.filter((o) => o.eventId !== params.eventId);
  const now = new Date().toISOString();

  const newObservations: SkillObservation[] = params.tags.map((tag, i) => {
    const { conceptId } = normalizeConceptId(tag, profile);
    return {
      id: `${params.eventId}-${conceptId}-${i}`,
      conceptId,
      eventId: params.eventId,
      track: params.track,
      polarity: tag.polarity,
      evidence: tag.evidence,
      bandAtTime: params.band,
      observedAt: now,
    };
  });

  const discoveredConcepts = maybePromoteDiscoveredConcepts(profile, params.tags);
  const merged: UserSkillProfile = {
    observations: [...withoutEvent, ...newObservations],
    conceptScores: [],
    discoveredConcepts,
  };
  merged.conceptScores = recomputeScores(merged);
  return merged;
}

export interface RankedConcept {
  concept: ConceptDefinition;
  score: UserConceptScore;
}

export function getWeakConcepts(
  profile: UserSkillProfile,
  limit = 5,
): RankedConcept[] {
  const ranked = profile.conceptScores
    .filter((s) => s.weaknessCount > 0 || s.mastery < 50)
    .sort((a, b) => {
      if (a.mastery !== b.mastery) return a.mastery - b.mastery;
      return b.weaknessCount - a.weaknessCount;
    })
    .slice(0, limit);

  return ranked
    .map((score) => {
      const concept = getConceptById(profile, score.conceptId);
      return concept ? { concept, score } : null;
    })
    .filter((r): r is RankedConcept => r !== null);
}

export function getStrongConcepts(
  profile: UserSkillProfile,
  limit = 5,
): RankedConcept[] {
  const ranked = profile.conceptScores
    .filter((s) => s.strengthCount > 0 && s.mastery >= 60)
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, limit);

  return ranked
    .map((score) => {
      const concept = getConceptById(profile, score.conceptId);
      return concept ? { concept, score } : null;
    })
    .filter((r): r is RankedConcept => r !== null);
}

export function getRecommendedConcepts(
  profile: UserSkillProfile,
  limit = 3,
): RankedConcept[] {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weak = getWeakConcepts(profile, 20);
  return weak
    .filter(({ score, concept }) => {
      const lastConceptPractice = profile.observations
        .filter((o) => o.conceptId === concept.id && o.track === "concept")
        .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())[0];
      if (!lastConceptPractice) return true;
      return new Date(lastConceptPractice.observedAt).getTime() < cutoff;
    })
    .slice(0, limit);
}

export function getLastConceptPracticeDate(
  profile: UserSkillProfile,
  conceptId: string,
): Date | null {
  const obs = profile.observations
    .filter((o) => o.conceptId === conceptId && o.track === "concept")
    .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())[0];
  return obs ? new Date(obs.observedAt) : null;
}

export function getObservationsForConcept(
  profile: UserSkillProfile,
  conceptId: string,
  limit = 5,
): SkillObservation[] {
  return profile.observations
    .filter((o) => o.conceptId === conceptId)
    .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
    .slice(0, limit);
}

export function getSkillTagsForEvent(
  profile: UserSkillProfile,
  eventId: string,
): SkillTag[] {
  return profile.observations
    .filter((o) => o.eventId === eventId)
    .map((o) => ({
      conceptId: o.conceptId,
      polarity: o.polarity,
      evidence: o.evidence,
    }));
}

export interface PracticeRecommendation {
  conceptId: string;
  label: string;
  description: string;
  evidence: string;
}

export function getPracticeRecommendations(
  profile: UserSkillProfile,
  params: { eventId?: string; skillTags?: SkillTag[] },
): PracticeRecommendation[] {
  const weaknessTags = (
    params.skillTags?.length
      ? params.skillTags
      : params.eventId
        ? getSkillTagsForEvent(profile, params.eventId)
        : []
  ).filter((tag) => tag.polarity === "weakness");

  const byConcept = new Map<string, PracticeRecommendation>();

  for (const tag of weaknessTags) {
    const { conceptId } = normalizeConceptId(tag, profile);
    const concept = getConceptById(profile, conceptId);
    const label =
      concept?.label ??
      tag.label ??
      conceptId.replace(/_/g, " ");
    const description =
      concept?.description ??
      tag.description ??
      "Targeted drills to practice this pattern.";
    const evidence = tag.evidence.trim();

    const existing = byConcept.get(conceptId);
    if (existing) {
      if (evidence && !existing.evidence.includes(evidence)) {
        existing.evidence = `${existing.evidence} · ${evidence}`;
      }
      continue;
    }

    byConcept.set(conceptId, {
      conceptId,
      label,
      description,
      evidence,
    });
  }

  return Array.from(byConcept.values());
}
