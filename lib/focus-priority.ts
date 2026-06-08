import { CONCEPT_SEED } from "@/data/concept-seed";
import { getConceptPrior } from "@/data/concept-priors";
import { DRILL_QUOTA_PER_CONCEPT } from "@/lib/focus-selection";
import type {
  ConceptCategory,
  FocusModelState,
  GradedSession,
  UserSkillProfile,
} from "@/lib/types";

const WRITING_CATEGORIES: ConceptCategory[] = [
  "grammar",
  "writing_structure",
  "vocabulary",
];

export interface ConceptMistakeStats {
  calendarInstances: number;
  calendarExercises: number;
  focusInstances: number;
  conceptDrillInstances: number;
  totalInstances: number;
}

export interface ConceptPriorityEntry {
  conceptId: string;
  /** How often the mistake opportunity appears on CELPIP writing tasks (1–5, AI-authored priors). */
  examFrequency: number;
  /** How often the learner makes this mistake across calendar + focus data (1–5, normalized). */
  userErrorRate: number;
  /** How easy the issue is to correct (1–5); adjusts upward with improvement, downward when stuck. */
  easeOfCorrection: number;
  priorityScore: number;
  mastery: number;
  trend: "improving" | "stable" | "declining";
  mistakeStats: ConceptMistakeStats;
  rationale: string;
}

export interface PracticeDistributionEntry {
  conceptId: string;
  weight: number;
  percent: number;
  inWindow: boolean;
}

export const PRACTICE_WINDOW_SIGMA = 0.75;
export const PRACTICE_WINDOW_FUTURE_PREVIEW = 5;

export interface RollingPracticeWindow {
  windowSize: number;
  windowConceptIds: string[];
  distribution: PracticeDistributionEntry[];
  /** Gaussian mean μ — shifts right as the lead concept improves. */
  meanIndex: number;
  sigma: number;
  /** Lead-concept progress in [0, 1] used to compute μ. */
  progress: number;
}

export interface PracticeDistributionChartPoint {
  index: number;
  conceptId: string;
  /** Assigned practice share (0 for concepts outside the active window). */
  practiceShare: number;
  /** Normalized Gaussian curve value over the visible chart range. */
  curveShare: number;
  inWindow: boolean;
  isFuture: boolean;
}

/**
 * Unnormalized Gaussian weight at priority-queue index i:
 *   w(i) = exp(−½ · ((i − μ) / σ)²)
 */
export function gaussianWeight(
  index: number,
  mean: number,
  sigma: number = PRACTICE_WINDOW_SIGMA,
): number {
  return Math.exp(-0.5 * ((index - mean) / sigma) ** 2);
}

/**
 * Assigned practice share for concepts in the active window:
 *   share(i) = w(i) / Σⱼ w(j) × 100   for j in active window indices
 * Concepts outside the window receive 0 until the window expands or μ shifts.
 */
export function normalizeGaussianShares(
  indices: number[],
  mean: number,
  sigma: number = PRACTICE_WINDOW_SIGMA,
): Map<number, number> {
  const weights = indices.map((index) => ({
    index,
    weight: gaussianWeight(index, mean, sigma),
  }));
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  const shares = new Map<number, number>();
  for (const entry of weights) {
    shares.set(
      entry.index,
      total > 0 ? (entry.weight / total) * 100 : 0,
    );
  }
  return shares;
}

export function getWritingConceptIds(profile: UserSkillProfile): string[] {
  const seedIds = CONCEPT_SEED.filter((c) =>
    WRITING_CATEGORIES.includes(c.category),
  ).map((c) => c.id);

  const discoveredIds = (profile.discoveredConcepts ?? [])
    .filter((c) => WRITING_CATEGORIES.includes(c.category))
    .map((c) => c.id);

  return [...new Set([...seedIds, ...discoveredIds])];
}

function writingEventIds(graded: GradedSession[]): Set<string> {
  return new Set(
    graded
      .filter((session) => session.focusSubTest === "Writing")
      .map((session) => session.eventId),
  );
}

/**
 * Aggregates weakness counts from calendar writing (subtest), focus assessments,
 * and concept-lab drills tied to writing concepts.
 */
export function computeConceptMistakeStats(
  profile: UserSkillProfile,
  graded: GradedSession[],
): Map<string, ConceptMistakeStats> {
  const events = writingEventIds(graded);
  const stats = new Map<string, ConceptMistakeStats>();
  const calendarSeenPerEvent = new Map<string, Set<string>>();

  const ensure = (conceptId: string): ConceptMistakeStats => {
    const existing = stats.get(conceptId);
    if (existing) return existing;
    const entry: ConceptMistakeStats = {
      calendarInstances: 0,
      calendarExercises: 0,
      focusInstances: 0,
      conceptDrillInstances: 0,
      totalInstances: 0,
    };
    stats.set(conceptId, entry);
    return entry;
  };

  for (const obs of profile.observations) {
    if (obs.polarity !== "weakness") continue;

    if (obs.track === "subtest" && events.has(obs.eventId)) {
      const entry = ensure(obs.conceptId);
      entry.calendarInstances += 1;
      let seen = calendarSeenPerEvent.get(obs.eventId);
      if (!seen) {
        seen = new Set<string>();
        calendarSeenPerEvent.set(obs.eventId, seen);
      }
      if (!seen.has(obs.conceptId)) {
        seen.add(obs.conceptId);
        entry.calendarExercises += 1;
      }
      continue;
    }

    if (obs.track === "focus") {
      ensure(obs.conceptId).focusInstances += 1;
      continue;
    }

    if (obs.track === "concept") {
      ensure(obs.conceptId).conceptDrillInstances += 1;
    }
  }

  for (const entry of stats.values()) {
    entry.totalInstances =
      entry.calendarInstances +
      entry.focusInstances +
      entry.conceptDrillInstances;
  }

  return stats;
}

function normalizeRate(count: number, maxCount: number): number {
  if (maxCount <= 0) return 1;
  return 1 + (Math.min(count, maxCount) / maxCount) * 4;
}

/**
 * Ease of correction starts from CELPIP difficulty priors (inverted) and adjusts
 * when the learner improves, declines, or stalls despite repeated practice.
 */
export function computeEaseOfCorrection(
  conceptId: string,
  profile: UserSkillProfile,
  focusModel: FocusModelState,
): number {
  const prior = getConceptPrior(conceptId);
  let ease = 6 - prior.difficulty;

  const score = profile.conceptScores.find((s) => s.conceptId === conceptId);
  if (score?.trend === "improving") ease += 0.4;
  if (score?.trend === "declining") ease -= 0.5;

  const baseline = focusModel.baselineByConcept[conceptId];
  const drills = focusModel.practiceCompleted[conceptId] ?? 0;
  if (baseline && score && drills >= DRILL_QUOTA_PER_CONCEPT) {
    if (score.mastery <= baseline.mastery + 2) {
      ease -= 0.6;
    } else if (score.mastery >= baseline.mastery + 10) {
      ease += 0.3;
    }
  }

  return Math.min(5, Math.max(1, ease));
}

function buildRationale(
  examFrequency: number,
  userErrorRate: number,
  easeOfCorrection: number,
  stats: ConceptMistakeStats,
): string {
  const parts: string[] = [];

  if (examFrequency >= 4) {
    parts.push("comes up often on CELPIP writing tasks");
  } else if (examFrequency <= 2) {
    parts.push("rarely tested directly on CELPIP writing");
  }

  if (stats.totalInstances > 0) {
    parts.push(
      `flagged ${stats.totalInstances} time${stats.totalInstances === 1 ? "" : "s"} across your exercises`,
    );
  } else {
    parts.push("no recorded mistakes yet");
  }

  if (easeOfCorrection >= 4) {
    parts.push("typically quick to fix");
  } else if (easeOfCorrection <= 2) {
    parts.push("needs sustained practice to improve");
  }

  return parts.join("; ") + ".";
}

export function computeConceptPriorities(
  profile: UserSkillProfile,
  graded: GradedSession[],
  focusModel: FocusModelState,
): ConceptPriorityEntry[] {
  const conceptIds = getWritingConceptIds(profile);
  const mistakeStats = computeConceptMistakeStats(profile, graded);

  const maxInstances = Math.max(
    1,
    ...Array.from(mistakeStats.values()).map((s) => s.totalInstances),
  );

  const entries = conceptIds.map((conceptId) => {
    const prior = getConceptPrior(conceptId);
    const stats = mistakeStats.get(conceptId) ?? {
      calendarInstances: 0,
      calendarExercises: 0,
      focusInstances: 0,
      conceptDrillInstances: 0,
      totalInstances: 0,
    };

    const examFrequency = prior.examFrequency;
    const userErrorRate = normalizeRate(stats.totalInstances, maxInstances);
    const easeOfCorrection = computeEaseOfCorrection(
      conceptId,
      profile,
      focusModel,
    );
    const score =
      profile.conceptScores.find((s) => s.conceptId === conceptId);
    const mastery = score?.mastery ?? 50;
    const masteryGap = (100 - mastery) / 100;

    const priorityScore =
      examFrequency * 2 +
      userErrorRate * 2 +
      easeOfCorrection * 1.5 +
      masteryGap * 1.5;

    return {
      conceptId,
      examFrequency,
      userErrorRate,
      easeOfCorrection,
      priorityScore,
      mastery,
      trend: score?.trend ?? "stable",
      mistakeStats: stats,
      rationale: buildRationale(
        examFrequency,
        userErrorRate,
        easeOfCorrection,
        stats,
      ),
    };
  });

  return entries.sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Rolling practice window: top N concepts by priority with Gaussian weights.
 * Mean shifts right as the lead concept improves, reducing its share and
 * opening room for the next concept in the queue.
 */
export function computeRollingPracticeWindow(
  priorities: ConceptPriorityEntry[],
  profile: UserSkillProfile,
  focusModel: FocusModelState,
  options?: { maxWindow?: number; minWindow?: number },
): RollingPracticeWindow {
  const minWindow = options?.minWindow ?? 2;
  const maxWindow = options?.maxWindow ?? 3;

  if (priorities.length === 0) {
    return {
      windowSize: 0,
      windowConceptIds: [],
      distribution: [],
      meanIndex: 0,
      sigma: PRACTICE_WINDOW_SIGMA,
      progress: 0,
    };
  }

  const top = priorities[0];
  const topScore = profile.conceptScores.find(
    (s) => s.conceptId === top.conceptId,
  );
  const baseline = focusModel.baselineByConcept[top.conceptId];
  const topDrills = focusModel.practiceCompleted[top.conceptId] ?? 0;
  const topMastery = topScore?.mastery ?? 50;

  let windowSize = minWindow;
  const masteryGain =
    baseline != null ? topMastery - baseline.mastery : topMastery - 50;
  if (
    topDrills >= DRILL_QUOTA_PER_CONCEPT ||
    topMastery >= 60 ||
    masteryGain >= 10
  ) {
    windowSize = maxWindow;
  }
  windowSize = Math.min(windowSize, priorities.length);

  const windowConceptIds = priorities
    .slice(0, windowSize)
    .map((entry) => entry.conceptId);

  const progress =
    baseline != null
      ? Math.min(1, Math.max(0, masteryGain / 25))
      : Math.min(1, Math.max(0, (topMastery - 45) / 30));

  const meanIndex = progress * Math.max(0, windowSize - 1) * 0.65;
  const sigma = PRACTICE_WINDOW_SIGMA;

  const rawWeights = windowConceptIds.map((conceptId, index) => ({
    conceptId,
    weight: gaussianWeight(index, meanIndex, sigma),
    inWindow: true,
  }));

  const weightTotal = rawWeights.reduce((sum, entry) => sum + entry.weight, 0);
  const distribution: PracticeDistributionEntry[] = rawWeights.map(
    (entry) => ({
      ...entry,
      percent: weightTotal > 0 ? (entry.weight / weightTotal) * 100 : 0,
    }),
  );

  for (const entry of priorities.slice(windowSize)) {
    distribution.push({
      conceptId: entry.conceptId,
      weight: 0,
      percent: 0,
      inWindow: false,
    });
  }

  return {
    windowSize,
    windowConceptIds,
    distribution,
    meanIndex,
    sigma,
    progress,
  };
}

/**
 * Chart series: active window bars + future preview slots.
 * Bars use assigned share (0 outside window); the curve shows the full Gaussian
 * normalized over all visible indices so upcoming concepts are visible on the hill.
 */
export function buildPracticeDistributionChartData(
  priorities: ConceptPriorityEntry[],
  window: RollingPracticeWindow,
  futurePreview = PRACTICE_WINDOW_FUTURE_PREVIEW,
): PracticeDistributionChartPoint[] {
  if (priorities.length === 0 || window.windowSize === 0) {
    return [];
  }

  const visibleCount = Math.min(
    window.windowSize + futurePreview,
    priorities.length,
  );
  const visibleIndices = Array.from({ length: visibleCount }, (_, i) => i);
  const curveShares = normalizeGaussianShares(
    visibleIndices,
    window.meanIndex,
    window.sigma,
  );
  const assignedByConcept = new Map(
    window.distribution.map((entry) => [entry.conceptId, entry.percent]),
  );
  const windowSet = new Set(window.windowConceptIds);

  return priorities.slice(0, visibleCount).map((entry, index) => ({
    index,
    conceptId: entry.conceptId,
    practiceShare: windowSet.has(entry.conceptId)
      ? (assignedByConcept.get(entry.conceptId) ?? 0)
      : 0,
    curveShare: curveShares.get(index) ?? 0,
    inWindow: windowSet.has(entry.conceptId),
    isFuture: index >= window.windowSize,
  }));
}

/** Recommended share for a concept in the active rolling window (0–100). */
export function getPracticeSharePercent(
  conceptId: string,
  window: RollingPracticeWindow,
): number {
  return (
    window.distribution.find((entry) => entry.conceptId === conceptId)
      ?.percent ?? 0
  );
}
