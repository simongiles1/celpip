import { getConceptPrior } from "@/data/concept-priors";
import { computeConceptMistakeStats } from "@/lib/focus-priority";
import { getConceptById } from "@/lib/skill-profile";
import type {
  FocusRankEntry,
  FocusSelectionRationale,
  FocusModelState,
  GradedSession,
  SkillTag,
  UserSkillProfile,
} from "@/lib/types";

export const FOCUS_SET_MIN = 2;
export const FOCUS_SET_MAX = 3;
export const GRADUATION_MASTERY_THRESHOLD = 70;
export const GRADUATION_MASTERY_DELTA = 15;
export const DRILL_QUOTA_PER_CONCEPT = 2;

export interface FocusCandidate {
  conceptId: string;
  instanceCount: number;
  aiRank?: FocusRankEntry;
}

export function countWeaknessInstances(
  weaknesses: SkillTag[],
  profile: UserSkillProfile,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tag of weaknesses) {
    const conceptId = tag.conceptId.replace(/^new:/, "");
    if (!getConceptById(profile, conceptId)) continue;
    counts.set(conceptId, (counts.get(conceptId) ?? 0) + 1);
  }
  return counts;
}

export function scoreCandidate(
  conceptId: string,
  instanceCount: number,
  profile: UserSkillProfile,
  aiRank?: FocusRankEntry,
): number {
  const prior = getConceptPrior(conceptId);
  const mastery =
    profile.conceptScores.find((s) => s.conceptId === conceptId)?.mastery ?? 50;

  const impact = aiRank?.estimatedScoreImpact ?? prior.celpipImpact;
  const effort = aiRank?.estimatedEffort ?? prior.difficulty;
  const frequency = prior.examFrequency;
  const masteryGap = (100 - mastery) / 100;
  const errorWeight = Math.min(Math.max(instanceCount, 1), 5) / 5;

  return (
    impact * 2 +
    frequency * 1.5 +
    errorWeight * 2 +
    masteryGap * 1.5 -
    effort * 1.2
  );
}

export function rankAllFocusCandidates(
  candidates: FocusCandidate[],
  profile: UserSkillProfile,
): FocusSelectionRationale[] {
  return candidates
    .map((candidate) => {
      const score = scoreCandidate(
        candidate.conceptId,
        candidate.instanceCount,
        profile,
        candidate.aiRank,
      );
      return {
        conceptId: candidate.conceptId,
        score,
        rationale:
          candidate.aiRank?.rationale ??
          "Ranked by CELPIP impact, exam frequency, error count, and current mastery.",
        estimatedScoreImpact:
          candidate.aiRank?.estimatedScoreImpact ??
          getConceptPrior(candidate.conceptId).celpipImpact,
        estimatedEffort:
          candidate.aiRank?.estimatedEffort ??
          getConceptPrior(candidate.conceptId).difficulty,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function selectFocusSet(
  candidates: FocusCandidate[],
  profile: UserSkillProfile,
  options?: {
    excludeConceptIds?: string[];
    minSize?: number;
    maxSize?: number;
  },
): { selected: string[]; rationale: FocusSelectionRationale[] } {
  const minSize = options?.minSize ?? FOCUS_SET_MIN;
  const maxSize = options?.maxSize ?? FOCUS_SET_MAX;
  const exclude = new Set(options?.excludeConceptIds ?? []);

  const scored = candidates
    .filter((c) => !exclude.has(c.conceptId))
    .map((candidate) => {
      const score = scoreCandidate(
        candidate.conceptId,
        candidate.instanceCount,
        profile,
        candidate.aiRank,
      );
      return {
        conceptId: candidate.conceptId,
        score,
        rationale:
          candidate.aiRank?.rationale ??
          "Selected by impact, exam frequency, error count, and current mastery.",
        estimatedScoreImpact:
          candidate.aiRank?.estimatedScoreImpact ??
          getConceptPrior(candidate.conceptId).celpipImpact,
        estimatedEffort:
          candidate.aiRank?.estimatedEffort ??
          getConceptPrior(candidate.conceptId).difficulty,
      };
    })
    .sort((a, b) => b.score - a.score);

  const selected = scored.slice(0, maxSize).map((item) => item.conceptId);
  const padded =
    selected.length >= minSize
      ? selected
      : scored.slice(0, minSize).map((item) => item.conceptId);

  return {
    selected: padded,
    rationale: scored.slice(0, maxSize),
  };
}

export function buildFocusCandidates(
  weaknesses: SkillTag[],
  profile: UserSkillProfile,
  aiRanks: FocusRankEntry[] = [],
  graded: GradedSession[] = [],
): FocusCandidate[] {
  const draftCounts = countWeaknessInstances(weaknesses, profile);
  const historical = computeConceptMistakeStats(profile, graded);
  const aiById = new Map(aiRanks.map((rank) => [rank.conceptId, rank]));

  const conceptIds = new Set([
    ...draftCounts.keys(),
    ...historical.keys(),
    ...aiRanks.map((rank) => rank.conceptId),
  ]);

  return Array.from(conceptIds).map((conceptId) => {
    const draftCount = draftCounts.get(conceptId) ?? 0;
    const historyCount = historical.get(conceptId)?.totalInstances ?? 0;
    return {
      conceptId,
      instanceCount: Math.max(draftCount, historyCount),
      aiRank: aiById.get(conceptId),
    };
  });
}

export function evaluateGraduation(
  conceptId: string,
  profile: UserSkillProfile,
  focusModel: FocusModelState,
  latestTags: SkillTag[],
): boolean {
  const hasWeakness = latestTags.some(
    (tag) =>
      tag.conceptId.replace(/^new:/, "") === conceptId &&
      tag.polarity === "weakness",
  );
  if (hasWeakness) return false;

  const score = profile.conceptScores.find((s) => s.conceptId === conceptId);
  const mastery = score?.mastery ?? 0;
  const baseline = focusModel.baselineByConcept[conceptId];

  if (mastery >= GRADUATION_MASTERY_THRESHOLD) return true;
  if (
    baseline &&
    mastery >= baseline.mastery + GRADUATION_MASTERY_DELTA
  ) {
    return true;
  }

  const hasStrength = latestTags.some(
    (tag) =>
      tag.conceptId.replace(/^new:/, "") === conceptId &&
      tag.polarity === "strength",
  );
  return hasStrength && !hasWeakness;
}

export function evaluateGraduations(
  focusConceptIds: string[],
  profile: UserSkillProfile,
  focusModel: FocusModelState,
  latestTags: SkillTag[],
): string[] {
  return focusConceptIds.filter((conceptId) =>
    evaluateGraduation(conceptId, profile, focusModel, latestTags),
  );
}

export function isDrillQuotaMet(
  focusModel: FocusModelState,
  conceptIds: string[],
  quota = DRILL_QUOTA_PER_CONCEPT,
): boolean {
  if (conceptIds.length === 0) return false;
  return conceptIds.every(
    (id) => (focusModel.practiceCompleted[id] ?? 0) >= quota,
  );
}

export function emptyFocusModel(): FocusModelState {
  return {
    activeFocus: [],
    focusHistory: [],
    practiceCompleted: {},
    baselineByConcept: {},
  };
}

export function ensureFocusModel(
  profile: UserSkillProfile,
): FocusModelState {
  return profile.focusModel ?? emptyFocusModel();
}
