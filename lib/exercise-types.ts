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
      "Calendar sessions from your study plan — exam-format practice biased toward today's focus skill.",
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
        ? "Themed practice — exam-format passage, biased toward today's focus skill."
        : "Themed practice — exam-format task, biased toward today's focus skill.",
  };
}

export function getThemedReadingStartCopy(options: {
  focusTarget: string;
  sessionLimitLabel: string;
  suggestedPassageLabel: string;
}): { title: string; body: string } {
  return {
    title: "Ready for themed reading practice?",
    body: `Today's focus: ${options.focusTarget}. You have ${options.sessionLimitLabel} for this study block. Suggested pace: about ${options.suggestedPassageLabel} per passage — adjust as needed. Real CELPIP Part format with 5-7 questions weighted toward ${options.focusTarget}. Use the remaining time to try another passage.`,
  };
}

function inferThemedWritingTaskLabel(practiceType: string): string {
  const t = practiceType.toLowerCase();
  if (/email|task\s*1/.test(t)) return "CELPIP Task 1 (email)";
  if (/survey|task\s*2/.test(t)) return "CELPIP Task 2 (survey opinion)";
  return practiceType;
}

export function getThemedWritingStartCopy(options: {
  focusTarget: string;
  suggestedTimeLabel: string;
  practiceType: string;
}): { title: string; body: string } {
  const taskLabel = inferThemedWritingTaskLabel(options.practiceType);
  return {
    title: "Ready for themed writing practice?",
    body: `Today's focus: ${options.focusTarget}. Format: ${taskLabel}. Suggested time: ${options.suggestedTimeLabel}. The prompt stays hidden until you start. Write 150-200 words addressing all required points.`,
  };
}

export const MARKDOWN_CONTENT_RULES = `MARKDOWN FORMATTING (required for instructions, example, examPrompt, and any other student-facing string):
- Use GitHub-Flavored Markdown ONLY. Never output HTML tags (<p>, <h3>, <table>, <ol>, <strong>, etc.).
- Headings: use ## and ###. Emphasis: **bold** and *italic*. Lists: use - or numbered lists (1.).
- Tables: one row per line with | column | separators |; add a | --- | separator row immediately after the header row. Never collapse an entire table onto one line.
- Reading Part 2 schedules/diagrams: use a markdown table or structured bullet list — not HTML tables or ASCII art.`;

export const THEMED_GENERATION_PREAMBLE = `IMPORTANT — EXERCISE TYPE: THEMED PRACTICE (skill-focused, exam-format).
This module is part of the student's personal study schedule. The student has only weeks before their CELPIP, so practice must resemble real exam items.
- Match the specified CELPIP Part / Task structure, register, length, and tone EXACTLY (same as a practice test would).
- The "lighter" aspect is question count only: use 5-7 reading questions per passage instead of the official 8-11, so the student can attempt multiple passages with feedback in one session.
- Bias the question-type mix toward the day's target skill (see Question-mix bias below) while keeping the passage exam-realistic.
- Distractors, vocabulary, and difficulty must remain CELPIP-grade — do not simplify.

${MARKDOWN_CONTENT_RULES}`;

export const CELPIP_MOCK_GENERATION_PREAMBLE = `IMPORTANT — EXERCISE TYPE: CELPIP PRACTICE TEST (strict format).
This is an official-style CELPIP practice test item, NOT a themed skill drill. Apply these constraints:
- Match the specified Part's length, register, structure, question count, and distractor design exactly.
- Default difficulty: CLB band 9-11 unless otherwise specified by the caller.
- NO scaffolding: do not provide vocabulary glosses, strategy hints, "look for X" prompts, or skill-focused framing.
- Distractors must be plausible, traceable to the passage, and require careful elimination (especially at high CLB).
- Topics should reflect realistic CELPIP themes (workplace email, community notice, opinion column, etc.).
- The student is being measured under exam conditions; do not simplify the test.

${MARKDOWN_CONTENT_RULES}`;
