import { describe, expect, it } from "vitest";
import { prepareFocusedWritingReview } from "@/lib/focus-annotations";
import { emptySkillProfile } from "@/lib/skill-profile";

describe("prepareFocusedWritingReview", () => {
  const text =
    "I go to the store yesterday. However, the report is complete.";

  it("tags focus-correct, focus-mistake, and other-mistake segments", () => {
    const review = prepareFocusedWritingReview(text, {
      focusHighlights: [
        {
          text: "However,",
          conceptId: "connectors_transitions",
          polarity: "correct",
          note: "Good connector",
        },
        {
          text: "I go to the store yesterday",
          conceptId: "verb_tenses",
          polarity: "mistake",
          note: "Tense error",
        },
      ],
      grammarCorrections: [
        {
          original: "the report is complete",
          corrected: "the report was complete",
          reason: "Past context",
          conceptId: "articles_a_an_the",
        },
      ],
      focusConceptIds: ["verb_tenses", "connectors_transitions"],
      profile: emptySkillProfile(),
    });

    const kinds = review.segments
      .filter((s) => s.type === "annotation")
      .map((s) => (s.type === "annotation" ? s.annotation.kind : "plain"));

    expect(kinds).toContain("focus-correct");
    expect(kinds).toContain("focus-mistake");
    expect(kinds).toContain("other-mistake");
    expect(review.focusCorrectCount).toBe(1);
    expect(review.focusMistakeCount).toBe(1);
    expect(review.otherMistakeCount).toBe(1);
  });
});
