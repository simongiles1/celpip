import { describe, expect, it } from "vitest";
import {
  buildPracticeDistributionChartData,
  computeConceptMistakeStats,
  computeConceptPriorities,
  computeEaseOfCorrection,
  computeRollingPracticeWindow,
  gaussianWeight,
  normalizeGaussianShares,
} from "@/lib/focus-priority";
import { emptyFocusModel } from "@/lib/focus-selection";
import { emptySkillProfile } from "@/lib/skill-profile";
import type { GradedSession, UserSkillProfile } from "@/lib/types";

function profileWithObservation(
  conceptId: string,
  track: "subtest" | "focus" | "concept",
  eventId: string,
): UserSkillProfile {
  return {
    ...emptySkillProfile(),
    observations: [
      {
        eventId,
        conceptId,
        track,
        polarity: "weakness",
        evidence: "sample",
        observedAt: new Date().toISOString(),
      },
    ],
    conceptScores: [
      {
        conceptId,
        weaknessCount: 2,
        strengthCount: 0,
        lastObservedAt: new Date().toISOString(),
        trend: "stable",
        mastery: 35,
      },
    ],
  };
}

const calendarWritingSession: GradedSession = {
  eventId: "evt-w1w-mon",
  curriculumUnitId: "w1w-mon",
  focusSubTest: "Writing",
  estimatedBand: 7,
  overallFeedback: "",
  positives: [],
  constructiveCriticism: [],
  grammarCorrections: [],
  studentSubmission: "test",
  gradedAt: new Date().toISOString(),
};

describe("computeConceptMistakeStats", () => {
  it("includes calendar subtest and focus track weaknesses", () => {
    const profile: UserSkillProfile = {
      ...emptySkillProfile(),
      observations: [
        {
          eventId: "evt-w1w-mon",
          conceptId: "verb_tenses",
          track: "subtest",
          polarity: "weakness",
          evidence: "I go yesterday",
          observedAt: new Date().toISOString(),
        },
        {
          eventId: "evt-focus-1",
          conceptId: "verb_tenses",
          track: "focus",
          polarity: "weakness",
          evidence: "I go yesterday",
          observedAt: new Date().toISOString(),
        },
        {
          eventId: "evt-concept-1",
          conceptId: "verb_tenses",
          track: "concept",
          polarity: "weakness",
          evidence: "wrong tense",
          observedAt: new Date().toISOString(),
        },
      ],
    };

    const stats = computeConceptMistakeStats(profile, [calendarWritingSession]);
    const verb = stats.get("verb_tenses");
    expect(verb?.calendarInstances).toBe(1);
    expect(verb?.focusInstances).toBe(1);
    expect(verb?.conceptDrillInstances).toBe(1);
    expect(verb?.totalInstances).toBe(3);
  });
});

describe("computeConceptPriorities", () => {
  it("ranks high-frequency exam concepts with user errors above rare low-error ones", () => {
    const profile = profileWithObservation(
      "verb_tenses",
      "subtest",
      "evt-w1w-mon",
    );
    const priorities = computeConceptPriorities(
      profile,
      [calendarWritingSession],
      emptyFocusModel(),
    );

    const verb = priorities.find((entry) => entry.conceptId === "verb_tenses");
    const punctuation = priorities.find(
      (entry) => entry.conceptId === "punctuation_mechanics",
    );

    expect(verb).toBeDefined();
    expect(punctuation).toBeDefined();
    expect(verb!.priorityScore).toBeGreaterThan(punctuation!.priorityScore);
    expect(verb!.userErrorRate).toBeGreaterThan(punctuation!.userErrorRate);
  });
});

describe("computeEaseOfCorrection", () => {
  it("lowers ease when drills do not improve mastery", () => {
    const focusModel = {
      ...emptyFocusModel(),
      baselineByConcept: {
        verb_tenses: { mastery: 40, instanceCount: 2 },
      },
      practiceCompleted: { verb_tenses: 2 },
    };
    const profile = profileWithObservation(
      "verb_tenses",
      "focus",
      "evt-focus-1",
    );

    const ease = computeEaseOfCorrection("verb_tenses", profile, focusModel);
    const baselineEase = computeEaseOfCorrection(
      "punctuation_mechanics",
      emptySkillProfile(),
      emptyFocusModel(),
    );

    expect(ease).toBeLessThan(baselineEase);
  });
});

describe("computeRollingPracticeWindow", () => {
  it("starts with two concepts and expands to three after quota progress", () => {
    const profile = profileWithObservation(
      "verb_tenses",
      "subtest",
      "evt-w1w-mon",
    );
    const priorities = computeConceptPriorities(
      profile,
      [calendarWritingSession],
      emptyFocusModel(),
    );

    const initial = computeRollingPracticeWindow(
      priorities,
      profile,
      emptyFocusModel(),
    );
    expect(initial.windowSize).toBe(2);

    const expanded = computeRollingPracticeWindow(priorities, profile, {
      ...emptyFocusModel(),
      practiceCompleted: { [priorities[0].conceptId]: 2 },
    });
    expect(expanded.windowSize).toBe(3);
  });

  it("shifts practice weight toward later window concepts as lead concept improves", () => {
    const profile: UserSkillProfile = {
      ...profileWithObservation("verb_tenses", "subtest", "evt-w1w-mon"),
      conceptScores: [
        {
          conceptId: "verb_tenses",
          weaknessCount: 0,
          strengthCount: 3,
          lastObservedAt: new Date().toISOString(),
          trend: "improving",
          mastery: 72,
        },
      ],
    };
    const focusModel = {
      ...emptyFocusModel(),
      baselineByConcept: {
        verb_tenses: { mastery: 40, instanceCount: 3 },
      },
      practiceCompleted: { verb_tenses: 2 },
    };
    const priorities = computeConceptPriorities(
      profile,
      [calendarWritingSession],
      focusModel,
    );
    const window = computeRollingPracticeWindow(
      priorities,
      profile,
      focusModel,
    );

    const firstShare = window.distribution[0]?.percent ?? 0;
    const secondShare = window.distribution[1]?.percent ?? 0;
    expect(firstShare).toBeLessThan(60);
    expect(secondShare).toBeGreaterThan(20);
  });
});

describe("gaussianWeight and chart data", () => {
  it("peaks at the mean index", () => {
    const atMean = gaussianWeight(1, 1, 0.75);
    const offMean = gaussianWeight(0, 1, 0.75);
    expect(atMean).toBeGreaterThan(offMean);
  });

  it("includes five future slots with zero assigned share but non-zero curve tail", () => {
    const profile = profileWithObservation(
      "verb_tenses",
      "subtest",
      "evt-w1w-mon",
    );
    const priorities = computeConceptPriorities(
      profile,
      [calendarWritingSession],
      emptyFocusModel(),
    );
    const window = computeRollingPracticeWindow(
      priorities,
      profile,
      emptyFocusModel(),
    );
    const chart = buildPracticeDistributionChartData(priorities, window);

    expect(chart.length).toBe(window.windowSize + 5);
    const future = chart.filter((point) => point.isFuture);
    expect(future).toHaveLength(5);
    expect(future.every((point) => point.practiceShare === 0)).toBe(true);
    expect(future.some((point) => point.curveShare > 0)).toBe(true);
  });

  it("normalizes curve shares to 100% over visible indices", () => {
    const shares = normalizeGaussianShares([0, 1, 2, 3, 4], 0.5, 0.75);
    const total = Array.from(shares.values()).reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(100, 5);
  });
});
