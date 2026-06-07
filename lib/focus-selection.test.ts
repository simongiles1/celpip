import { describe, expect, it } from "vitest";
import {
  DRILL_QUOTA_PER_CONCEPT,
  evaluateGraduation,
  isDrillQuotaMet,
  scoreCandidate,
  selectFocusSet,
} from "@/lib/focus-selection";
import { emptySkillProfile } from "@/lib/skill-profile";
import type { FocusModelState, SkillTag, UserSkillProfile } from "@/lib/types";

function profileWithMastery(
  conceptId: string,
  mastery: number,
): UserSkillProfile {
  return {
    ...emptySkillProfile(),
    conceptScores: [
      {
        conceptId,
        weaknessCount: mastery < 50 ? 3 : 0,
        strengthCount: mastery >= 50 ? 2 : 0,
        lastObservedAt: new Date().toISOString(),
        trend: "stable",
        mastery,
      },
    ],
  };
}

describe("scoreCandidate", () => {
  it("ranks high-impact frequent weaknesses above low-impact issues", () => {
    const profile = profileWithMastery("verb_tenses", 30);
    const highImpact = scoreCandidate("verb_tenses", 3, profile, {
      conceptId: "verb_tenses",
      estimatedScoreImpact: 5,
      estimatedEffort: 2,
      rationale: "Core CELPIP issue",
    });
    const lowImpact = scoreCandidate("punctuation_mechanics", 3, profile, {
      conceptId: "punctuation_mechanics",
      estimatedScoreImpact: 2,
      estimatedEffort: 2,
      rationale: "Minor mechanics",
    });
    expect(highImpact).toBeGreaterThan(lowImpact);
  });
});

describe("selectFocusSet", () => {
  it("returns 2-3 concepts ordered by deterministic score", () => {
    const profile = emptySkillProfile();
    const { selected, rationale } = selectFocusSet(
      [
        {
          conceptId: "task_fulfillment",
          instanceCount: 2,
          aiRank: {
            conceptId: "task_fulfillment",
            estimatedScoreImpact: 5,
            estimatedEffort: 3,
            rationale: "High impact",
          },
        },
        {
          conceptId: "punctuation_mechanics",
          instanceCount: 1,
          aiRank: {
            conceptId: "punctuation_mechanics",
            estimatedScoreImpact: 2,
            estimatedEffort: 2,
            rationale: "Low impact",
          },
        },
        {
          conceptId: "verb_tenses",
          instanceCount: 3,
          aiRank: {
            conceptId: "verb_tenses",
            estimatedScoreImpact: 5,
            estimatedEffort: 3,
            rationale: "Frequent errors",
          },
        },
      ],
      profile,
    );

    expect(selected.length).toBeGreaterThanOrEqual(2);
    expect(selected.length).toBeLessThanOrEqual(3);
    expect(selected[0]).toBe("verb_tenses");
    expect(rationale[0]?.conceptId).toBe("verb_tenses");
  });
});

describe("evaluateGraduation", () => {
  const focusModel: FocusModelState = {
    activeFocus: ["verb_tenses"],
    focusHistory: [],
    practiceCompleted: {},
    baselineByConcept: {
      verb_tenses: { mastery: 40, instanceCount: 3 },
    },
  };

  it("does not graduate when weakness remains", () => {
    const profile = profileWithMastery("verb_tenses", 55);
    const tags: SkillTag[] = [
      {
        conceptId: "verb_tenses",
        polarity: "weakness",
        evidence: "I go yesterday",
      },
    ];
    expect(evaluateGraduation("verb_tenses", profile, focusModel, tags)).toBe(
      false,
    );
  });

  it("graduates when mastery threshold met without weakness", () => {
    const profile = profileWithMastery("verb_tenses", 72);
    const tags: SkillTag[] = [
      {
        conceptId: "verb_tenses",
        polarity: "strength",
        evidence: "I went yesterday",
      },
    ];
    expect(evaluateGraduation("verb_tenses", profile, focusModel, tags)).toBe(
      true,
    );
  });
});

describe("isDrillQuotaMet", () => {
  it("requires quota per active concept", () => {
    const focusModel: FocusModelState = {
      activeFocus: ["verb_tenses", "task_fulfillment"],
      focusHistory: [],
      practiceCompleted: {
        verb_tenses: DRILL_QUOTA_PER_CONCEPT,
        task_fulfillment: 1,
      },
      baselineByConcept: {},
    };
    expect(
      isDrillQuotaMet(focusModel, ["verb_tenses", "task_fulfillment"]),
    ).toBe(false);
    focusModel.practiceCompleted.task_fulfillment = DRILL_QUOTA_PER_CONCEPT;
    expect(
      isDrillQuotaMet(focusModel, ["verb_tenses", "task_fulfillment"]),
    ).toBe(true);
  });
});
