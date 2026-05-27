import type { CelpipReadingPart } from "@/lib/types";

export type MockSpecKind =
  | "reading_part"
  | "reading_full"
  | "writing_task"
  | "writing_full";

export type MockSubTest = "Reading" | "Writing";

export interface MockReadingPartSegment {
  celpipPart: CelpipReadingPart;
  questionCount: number;
  timeLimitSec: number;
}

export interface MockWritingTaskSegment {
  /** "task_1" = email, "task_2" = survey opinion. */
  task: "task_1" | "task_2";
  timeLimitSec: number;
}

export interface MockSpec {
  id: string;
  kind: MockSpecKind;
  subTest: MockSubTest;
  label: string;
  description: string;
  totalTimeSec: number;
  readingSegments?: MockReadingPartSegment[];
  writingSegments?: MockWritingTaskSegment[];
}

const READING_PART_TIME_SEC = 11 * 60;
const WRITING_TASK_1_SEC = 27 * 60;
const WRITING_TASK_2_SEC = 26 * 60;

export const CELPIP_PART_OFFICIAL_QUESTIONS: Record<CelpipReadingPart, number> =
  {
    part_1: 11,
    part_2: 8,
    part_3: 9,
    part_4: 10,
  };

export const READING_PART_LABEL: Record<CelpipReadingPart, string> = {
  part_1: "Part 1 — Correspondence",
  part_2: "Part 2 — Diagram",
  part_3: "Part 3 — Information Matching",
  part_4: "Part 4 — Viewpoints",
};

function makeReadingPartSpec(part: CelpipReadingPart): MockSpec {
  return {
    id: `mock-reading-${part}`,
    kind: "reading_part",
    subTest: "Reading",
    label: `Reading: ${READING_PART_LABEL[part]}`,
    description: `Single CELPIP Reading ${part.replace("_", " ")} in strict format with official question count and timing.`,
    totalTimeSec: READING_PART_TIME_SEC,
    readingSegments: [
      {
        celpipPart: part,
        questionCount: CELPIP_PART_OFFICIAL_QUESTIONS[part],
        timeLimitSec: READING_PART_TIME_SEC,
      },
    ],
  };
}

const FULL_READING_SEGMENTS: MockReadingPartSegment[] = (
  ["part_1", "part_2", "part_3", "part_4"] as CelpipReadingPart[]
).map((part) => ({
  celpipPart: part,
  questionCount: CELPIP_PART_OFFICIAL_QUESTIONS[part],
  timeLimitSec: READING_PART_TIME_SEC,
}));

const READING_FULL_SPEC: MockSpec = {
  id: "mock-reading-full",
  kind: "reading_full",
  subTest: "Reading",
  label: "Full Reading Mock (38 questions, ~55 minutes)",
  description:
    "All four CELPIP Reading parts back-to-back. Each part has its own strict timer. No scaffolding, no skill hints.",
  totalTimeSec: FULL_READING_SEGMENTS.reduce((sum, s) => sum + s.timeLimitSec, 0),
  readingSegments: FULL_READING_SEGMENTS,
};

const WRITING_TASK_1_SPEC: MockSpec = {
  id: "mock-writing-task-1",
  kind: "writing_task",
  subTest: "Writing",
  label: "Writing: Task 1 (Email, 27 min)",
  description:
    "Single CELPIP email task with strict 27-minute timer. Three bullet points must be addressed.",
  totalTimeSec: WRITING_TASK_1_SEC,
  writingSegments: [{ task: "task_1", timeLimitSec: WRITING_TASK_1_SEC }],
};

const WRITING_TASK_2_SPEC: MockSpec = {
  id: "mock-writing-task-2",
  kind: "writing_task",
  subTest: "Writing",
  label: "Writing: Task 2 (Survey Opinion, 26 min)",
  description:
    "Single CELPIP survey opinion task with strict 26-minute timer. Pick one option and defend it.",
  totalTimeSec: WRITING_TASK_2_SEC,
  writingSegments: [{ task: "task_2", timeLimitSec: WRITING_TASK_2_SEC }],
};

const WRITING_FULL_SPEC: MockSpec = {
  id: "mock-writing-full",
  kind: "writing_full",
  subTest: "Writing",
  label: "Full Writing Mock (Task 1 + Task 2, 53 min)",
  description:
    "Both writing tasks back-to-back under strict timers (27 min email then 26 min survey).",
  totalTimeSec: WRITING_TASK_1_SEC + WRITING_TASK_2_SEC,
  writingSegments: [
    { task: "task_1", timeLimitSec: WRITING_TASK_1_SEC },
    { task: "task_2", timeLimitSec: WRITING_TASK_2_SEC },
  ],
};

export const MOCK_SPECS: MockSpec[] = [
  makeReadingPartSpec("part_1"),
  makeReadingPartSpec("part_2"),
  makeReadingPartSpec("part_3"),
  makeReadingPartSpec("part_4"),
  READING_FULL_SPEC,
  WRITING_TASK_1_SPEC,
  WRITING_TASK_2_SPEC,
  WRITING_FULL_SPEC,
];

export function getMockSpec(id: string): MockSpec | undefined {
  return MOCK_SPECS.find((s) => s.id === id);
}

export const MOCK_SPECS_BY_SUBTEST: Record<MockSubTest, MockSpec[]> = {
  Reading: MOCK_SPECS.filter((s) => s.subTest === "Reading"),
  Writing: MOCK_SPECS.filter((s) => s.subTest === "Writing"),
};

/** Generate a unique event ID for a mock attempt. */
export function newMockEventId(specId: string): string {
  return `mock-${specId}-${Date.now()}`;
}

/** Format a time-limit label, eg "27 min". */
export function formatMockDuration(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  return `${minutes} min`;
}
