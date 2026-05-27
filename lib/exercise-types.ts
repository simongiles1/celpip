import type { CurriculumUnit, FocusSubTest } from "@/lib/types";

/** How practice is framed in the product — keep these distinct in UI and AI prompts. */
export type ExerciseKind = "concept" | "themed" | "celpip_mock";

export const EXERCISE_KIND_META: Record<
  ExerciseKind,
  { label: string; shortDescription: string }
> = {
  concept: {
    label: "Concept drill",
    shortDescription:
      "Short exercises on one grammar or strategy concept (Concept Lab).",
  },
  themed: {
    label: "Themed practice",
    shortDescription:
      "Calendar sessions from your study plan — skill-focused practice, not official test items.",
  },
  celpip_mock: {
    label: "CELPIP practice test",
    shortDescription:
      "Full-format tasks with official-style timing and scoring (Practice Tests area).",
  },
};

export function getExerciseKindForUnit(unit: CurriculumUnit): ExerciseKind {
  if (unit.focusSubTest === "Concept") return "concept";
  if (unit.focusSubTest === "EXAM") return "celpip_mock";
  return "themed";
}

export function getExerciseKindForSubTest(subTest: FocusSubTest): ExerciseKind {
  if (subTest === "Concept") return "concept";
  if (subTest === "EXAM") return "celpip_mock";
  return "themed";
}

export function isCalendarThemedSession(unit: CurriculumUnit): boolean {
  return getExerciseKindForUnit(unit) === "themed";
}

export function getThemedSessionIntro(subTest: "Reading" | "Writing"): {
  badge: string;
  disclaimer: string;
} {
  return {
    badge: EXERCISE_KIND_META.themed.label,
    disclaimer:
      subTest === "Reading"
        ? "Themed reading practice from your study schedule — not an official CELPIP passage."
        : "Themed writing practice from your study schedule — not an official CELPIP task.",
  };
}

export function getThemedReadingStartCopy(options: {
  focusTarget: string;
  sessionLimitLabel: string;
  suggestedPassageLabel: string;
}): { title: string; body: string } {
  return {
    title: "Ready for themed reading practice?",
    body: `Today's focus: ${options.focusTarget}. You have ${options.sessionLimitLabel} for this study block. Suggested pace: about ${options.suggestedPassageLabel} per passage — adjust as needed. Content is generated to practice the skill, not to replicate a full CELPIP part.`,
  };
}

export function getThemedWritingStartCopy(options: {
  focusTarget: string;
  suggestedTimeLabel: string;
  practiceType: string;
}): { title: string; body: string } {
  return {
    title: "Ready for themed writing practice?",
    body: `Today's focus: ${options.focusTarget}. Suggested time: ${options.suggestedTimeLabel} (loosely based on ${options.practiceType} format for practice only). The prompt stays hidden until you start. This is not an official CELPIP task.`,
  };
}

export const THEMED_GENERATION_PREAMBLE = `IMPORTANT — EXERCISE TYPE: THEMED PRACTICE (not an official CELPIP test item).
This module is for the student's personal study schedule. Prioritize the target skill/concept over exam authenticity.
Use the practice assignment type only as a loose format reference. Shorter passages, fewer questions, or abbreviated tasks are expected.`;

export const CELPIP_MOCK_GENERATION_PREAMBLE = `IMPORTANT — EXERCISE TYPE: CELPIP PRACTICE TEST (strict format).
This is an official-style CELPIP practice test item, NOT a themed skill drill. Apply these constraints:
- Match the specified Part's length, register, structure, question count, and distractor design exactly.
- Default difficulty: CLB band 9-11 unless otherwise specified by the caller.
- NO scaffolding: do not provide vocabulary glosses, strategy hints, "look for X" prompts, or skill-focused framing.
- Distractors must be plausible, traceable to the passage, and require careful elimination (especially at high CLB).
- Topics should reflect realistic CELPIP themes (workplace email, community notice, opinion column, etc.).
- The student is being measured under exam conditions; do not simplify the test.`;
