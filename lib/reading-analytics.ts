import { getReadingResultsForSession, isReadingSubmissionEnvelope } from "@/lib/reading-submission";
import type {
  CelpipReadingPart,
  GradedSession,
  ReadingQuestionResult,
  ReadingQuestionType,
} from "@/lib/types";

/** All four CELPIP Parts in canonical order. */
export const CELPIP_READING_PARTS: CelpipReadingPart[] = [
  "part_1",
  "part_2",
  "part_3",
  "part_4",
];

export const CELPIP_READING_PART_LABELS: Record<CelpipReadingPart, string> = {
  part_1: "Part 1 · Correspondence",
  part_2: "Part 2 · Diagram",
  part_3: "Part 3 · Info Matching",
  part_4: "Part 4 · Viewpoints",
};

/** Official CELPIP question counts per Part — used as denominators for pacing targets. */
export const CELPIP_PART_OFFICIAL_QUESTIONS: Record<CelpipReadingPart, number> = {
  part_1: 11,
  part_2: 8,
  part_3: 9,
  part_4: 10,
};

/** Official suggested time-per-question (seconds) inferred from the published 11-12 min/Part target. */
export const CELPIP_PART_TARGET_SECONDS_PER_Q: Record<CelpipReadingPart, number> = {
  part_1: 60,
  part_2: 75,
  part_3: 73,
  part_4: 72,
};

export const READING_QUESTION_TYPES: ReadingQuestionType[] = [
  "main_idea",
  "detail_extraction",
  "inference",
  "paraphrase_recognition",
  "vocabulary_in_context",
  "distractor_analysis",
  "tone_attitude",
];

export const READING_QUESTION_TYPE_LABELS: Record<ReadingQuestionType, string> = {
  main_idea: "Main idea",
  detail_extraction: "Detail extraction",
  inference: "Inference",
  paraphrase_recognition: "Paraphrase recognition",
  vocabulary_in_context: "Vocabulary in context",
  distractor_analysis: "Distractor analysis",
  tone_attitude: "Tone / attitude",
};

/** Extract per-question results from any reading graded session. */
export function getReadingResults(
  session: GradedSession,
): ReadingQuestionResult[] {
  if (session.focusSubTest !== "Reading") return [];
  if (!isReadingSubmissionEnvelope(session.studentSubmission)) return [];
  return getReadingResultsForSession(session);
}

/** All reading-question results across every graded reading session. */
export function getAllReadingResults(
  graded: GradedSession[],
): Array<ReadingQuestionResult & { sessionId: string; gradedAt: string; isMock: boolean }> {
  const out: Array<
    ReadingQuestionResult & { sessionId: string; gradedAt: string; isMock: boolean }
  > = [];
  for (const session of graded) {
    const results = getReadingResults(session);
    for (const r of results) {
      out.push({
        ...r,
        sessionId: session.eventId,
        gradedAt: session.gradedAt,
        isMock: Boolean(session.isMock),
      });
    }
  }
  return out;
}

export interface AccuracyBucket {
  correct: number;
  total: number;
  pct: number;
}

function emptyBucket(): AccuracyBucket {
  return { correct: 0, total: 0, pct: 0 };
}

function finalizeBucket(bucket: AccuracyBucket): AccuracyBucket {
  return {
    ...bucket,
    pct: bucket.total > 0 ? bucket.correct / bucket.total : 0,
  };
}

/** Accuracy bucketed by CELPIP Part. Includes Parts with zero observations. */
export function getReadingAccuracyByPart(
  graded: GradedSession[],
): Record<CelpipReadingPart, AccuracyBucket> {
  const buckets: Record<CelpipReadingPart, AccuracyBucket> = {
    part_1: emptyBucket(),
    part_2: emptyBucket(),
    part_3: emptyBucket(),
    part_4: emptyBucket(),
  };
  for (const result of getAllReadingResults(graded)) {
    const part = result.celpipPart;
    if (!part) continue;
    buckets[part].total++;
    if (result.isCorrect) buckets[part].correct++;
  }
  for (const part of CELPIP_READING_PARTS) {
    buckets[part] = finalizeBucket(buckets[part]);
  }
  return buckets;
}

/** Accuracy bucketed by question type. Only includes types with data. */
export function getReadingAccuracyByQuestionType(
  graded: GradedSession[],
): Array<{ type: ReadingQuestionType; bucket: AccuracyBucket }> {
  const map = new Map<ReadingQuestionType, AccuracyBucket>();
  for (const result of getAllReadingResults(graded)) {
    const type = result.questionType;
    if (!type) continue;
    const bucket = map.get(type) ?? emptyBucket();
    bucket.total++;
    if (result.isCorrect) bucket.correct++;
    map.set(type, bucket);
  }
  return Array.from(map.entries())
    .map(([type, bucket]) => ({ type, bucket: finalizeBucket(bucket) }))
    .sort((a, b) => a.bucket.pct - b.bucket.pct);
}

/** Average seconds-per-question per CELPIP Part. */
export function getReadingPacingByPart(
  graded: GradedSession[],
): Record<
  CelpipReadingPart,
  { avgSeconds: number; observations: number; targetSeconds: number }
> {
  const sums: Record<CelpipReadingPart, { sum: number; count: number }> = {
    part_1: { sum: 0, count: 0 },
    part_2: { sum: 0, count: 0 },
    part_3: { sum: 0, count: 0 },
    part_4: { sum: 0, count: 0 },
  };
  for (const result of getAllReadingResults(graded)) {
    const part = result.celpipPart;
    if (!part) continue;
    if (result.timeSpentSeconds == null) continue;
    sums[part].sum += result.timeSpentSeconds;
    sums[part].count++;
  }
  const out: Record<
    CelpipReadingPart,
    { avgSeconds: number; observations: number; targetSeconds: number }
  > = {
    part_1: { avgSeconds: 0, observations: 0, targetSeconds: 0 },
    part_2: { avgSeconds: 0, observations: 0, targetSeconds: 0 },
    part_3: { avgSeconds: 0, observations: 0, targetSeconds: 0 },
    part_4: { avgSeconds: 0, observations: 0, targetSeconds: 0 },
  };
  for (const part of CELPIP_READING_PARTS) {
    const { sum, count } = sums[part];
    out[part] = {
      avgSeconds: count > 0 ? sum / count : 0,
      observations: count,
      targetSeconds: CELPIP_PART_TARGET_SECONDS_PER_Q[part],
    };
  }
  return out;
}

/** Stamina curve: accuracy by global question position (Q1-10, Q11-20, Q21-38). */
export function getReadingStaminaCurve(
  graded: GradedSession[],
): Array<{ bucketLabel: string; bucket: AccuracyBucket; min: number; max: number }> {
  const buckets = [
    { label: "Q1-10", min: 0, max: 9, bucket: emptyBucket() },
    { label: "Q11-20", min: 10, max: 19, bucket: emptyBucket() },
    { label: "Q21-30", min: 20, max: 29, bucket: emptyBucket() },
    { label: "Q31-38+", min: 30, max: Number.MAX_SAFE_INTEGER, bucket: emptyBucket() },
  ];

  for (const session of graded) {
    if (session.focusSubTest !== "Reading") continue;
    if (!session.isMock) continue;
    const results = getReadingResults(session);
    results.forEach((r) => {
      const idx = r.index;
      const target = buckets.find((b) => idx >= b.min && idx <= b.max);
      if (!target) return;
      target.bucket.total++;
      if (r.isCorrect) target.bucket.correct++;
    });
  }

  return buckets.map((b) => ({
    bucketLabel: b.label,
    min: b.min,
    max: b.max,
    bucket: finalizeBucket(b.bucket),
  }));
}

/** Distribution of practice volume across CLB difficulty bands. */
export function getReadingDifficultyDistribution(
  graded: GradedSession[],
): Array<{ clbBand: number; attempts: number; accuracy: AccuracyBucket }> {
  const map = new Map<number, AccuracyBucket>();
  for (const session of graded) {
    if (session.focusSubTest !== "Reading") continue;
    if (!isReadingSubmissionEnvelope(session.studentSubmission)) continue;
    const meta = session.studentSubmission.gradeMetadata;
    if (!meta) continue;

    const passageBand = meta.passageTargetClbBand;
    const results = meta.readingResults ?? [];

    if (passageBand != null) {
      const bucket = map.get(passageBand) ?? emptyBucket();
      bucket.total += results.length;
      bucket.correct += results.filter((r) => r.isCorrect).length;
      map.set(passageBand, bucket);
      continue;
    }

    for (const r of results) {
      const band = r.targetClbBand;
      if (band == null) continue;
      const bucket = map.get(band) ?? emptyBucket();
      bucket.total++;
      if (r.isCorrect) bucket.correct++;
      map.set(band, bucket);
    }
  }

  return Array.from(map.entries())
    .map(([clbBand, bucket]) => ({
      clbBand,
      attempts: bucket.total,
      accuracy: finalizeBucket(bucket),
    }))
    .sort((a, b) => a.clbBand - b.clbBand);
}

/** Most recent mock attempts, summary form. */
export interface MockAttemptSummary {
  eventId: string;
  mockSpecId: string;
  gradedAt: string;
  estimatedBand: number;
  partBreakdown: Partial<Record<CelpipReadingPart, AccuracyBucket>>;
  totalScore: AccuracyBucket;
  focusSubTest: string;
}

export function getMockAttemptsSummary(
  graded: GradedSession[],
): MockAttemptSummary[] {
  const summaries: MockAttemptSummary[] = [];
  for (const session of graded) {
    if (!session.isMock) continue;

    const partBreakdown: Partial<Record<CelpipReadingPart, AccuracyBucket>> = {};
    let total = emptyBucket();

    if (session.focusSubTest === "Reading") {
      const results = getReadingResults(session);
      for (const r of results) {
        total.total++;
        if (r.isCorrect) total.correct++;
        const part = r.celpipPart;
        if (!part) continue;
        const bucket = partBreakdown[part] ?? emptyBucket();
        bucket.total++;
        if (r.isCorrect) bucket.correct++;
        partBreakdown[part] = bucket;
      }
      total = finalizeBucket(total);
      for (const part of CELPIP_READING_PARTS) {
        if (partBreakdown[part]) {
          partBreakdown[part] = finalizeBucket(partBreakdown[part]!);
        }
      }
    }

    summaries.push({
      eventId: session.eventId,
      mockSpecId: session.mockSpecId ?? "unknown",
      gradedAt: session.gradedAt,
      estimatedBand: session.estimatedBand,
      partBreakdown,
      totalScore: total,
      focusSubTest: session.focusSubTest,
    });
  }
  return summaries.sort(
    (a, b) => new Date(b.gradedAt).getTime() - new Date(a.gradedAt).getTime(),
  );
}

/** Weakest CELPIP Part (lowest accuracy) — returns null if not enough data. */
export function getWeakestReadingPart(
  graded: GradedSession[],
  minSampleSize = 5,
): { part: CelpipReadingPart; bucket: AccuracyBucket } | null {
  const byPart = getReadingAccuracyByPart(graded);
  const candidates = CELPIP_READING_PARTS.filter(
    (p) => byPart[p].total >= minSampleSize,
  ).map((p) => ({ part: p, bucket: byPart[p] }));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.bucket.pct - b.bucket.pct);
  return candidates[0];
}
