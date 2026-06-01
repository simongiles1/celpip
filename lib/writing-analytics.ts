import type { GradedSession, UserSkillProfile } from "@/lib/types";

export interface WritingConceptStats {
  exerciseCount: number;
  instanceCount: number;
}

export interface WritingConceptStatsEntry extends WritingConceptStats {
  conceptId: string;
}

function writingEventIds(graded: GradedSession[]): Set<string> {
  return new Set(
    graded
      .filter((session) => session.focusSubTest === "Writing")
      .map((session) => session.eventId),
  );
}

/**
 * exerciseCount: distinct writing exercises where the concept was flagged (max 1 per exercise).
 * instanceCount: total weakness tags for the concept across all writing exercises.
 */
export function computeWritingConceptStats(
  profile: UserSkillProfile,
  graded: GradedSession[],
): Record<string, WritingConceptStats> {
  const events = writingEventIds(graded);
  const stats = new Map<string, WritingConceptStats>();
  const seenPerEvent = new Map<string, Set<string>>();

  for (const obs of profile.observations) {
    if (obs.polarity !== "weakness") continue;
    if (obs.track !== "subtest") continue;
    if (!events.has(obs.eventId)) continue;

    const entry = stats.get(obs.conceptId) ?? {
      exerciseCount: 0,
      instanceCount: 0,
    };
    entry.instanceCount += 1;

    let seen = seenPerEvent.get(obs.eventId);
    if (!seen) {
      seen = new Set<string>();
      seenPerEvent.set(obs.eventId, seen);
    }
    if (!seen.has(obs.conceptId)) {
      seen.add(obs.conceptId);
      entry.exerciseCount += 1;
    }

    stats.set(obs.conceptId, entry);
  }

  return Object.fromEntries(stats);
}

export function getWritingConceptStatsEntries(
  profile: UserSkillProfile,
  graded: GradedSession[],
): WritingConceptStatsEntry[] {
  const statsByConcept = computeWritingConceptStats(profile, graded);

  return Object.entries(statsByConcept)
    .filter(
      ([, stats]) => stats.exerciseCount > 0 || stats.instanceCount > 0,
    )
    .map(([conceptId, stats]) => ({ conceptId, ...stats }))
    .sort((a, b) => {
      if (b.instanceCount !== a.instanceCount) {
        return b.instanceCount - a.instanceCount;
      }
      if (b.exerciseCount !== a.exerciseCount) {
        return b.exerciseCount - a.exerciseCount;
      }
      return a.conceptId.localeCompare(b.conceptId);
    });
}

export function countWritingExercises(graded: GradedSession[]): number {
  return graded.filter((session) => session.focusSubTest === "Writing").length;
}

export function writingConceptStatsEqual(
  a: Record<string, WritingConceptStats> | undefined,
  b: Record<string, WritingConceptStats>,
): boolean {
  const keysA = Object.keys(a ?? {});
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysB.every((key) => {
    const left = a?.[key];
    const right = b[key];
    return (
      left?.exerciseCount === right.exerciseCount &&
      left?.instanceCount === right.instanceCount
    );
  });
}
