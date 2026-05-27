/** Official CELPIP Writing task limits (minutes). */
const WRITING_TASK1_MIN = 27;
const WRITING_TASK2_MIN = 26;

export function getWritingExamTimeLimitSeconds(practiceType: string): number {
  const lower = practiceType.toLowerCase();

  if (
    /task\s*1\s*[+&]\s*task\s*2|task\s*1\s*\+\s*task\s*2|full essay|back-to-back writing/i.test(
      practiceType,
    )
  ) {
    return (WRITING_TASK1_MIN + WRITING_TASK2_MIN) * 60;
  }

  if (/survey|task\s*2/.test(lower)) {
    return WRITING_TASK2_MIN * 60;
  }

  return WRITING_TASK1_MIN * 60;
}

export function formatExamCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getWritingExamTimeLimitLabel(practiceType: string): string {
  const totalSeconds = getWritingExamTimeLimitSeconds(practiceType);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** CELPIP-style per-passage reading limits (minutes). */
const READING_PART_MIN = 11;
const READING_MIXED_MIN = 12;
const READING_MOCK_SLICE_MIN = 15;

export function getReadingPassageTimeLimitSeconds(practiceType: string): number {
  const lower = practiceType.toLowerCase();

  if (
    /all reading parts|38 questions|full.*reading|timed.*reading mock/i.test(
      practiceType,
    )
  ) {
    return READING_MOCK_SLICE_MIN * 60;
  }

  if (/mixed mini/i.test(lower)) {
    return READING_MIXED_MIN * 60;
  }

  return READING_PART_MIN * 60;
}

export function getReadingPassageTimeLimitLabel(practiceType: string): string {
  const totalSeconds = getReadingPassageTimeLimitSeconds(practiceType);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** Suggested pace label for themed calendar reading (not official CELPIP timing). */
export function getThemedReadingPassagePaceLabel(practiceType: string): string {
  return getReadingPassageTimeLimitLabel(practiceType);
}

export function getSessionTimeLimitSeconds(
  defaultSessionDurationMin: number,
): number {
  return Math.max(1, defaultSessionDurationMin) * 60;
}

export function getSessionTimeLimitLabel(
  defaultSessionDurationMin: number,
): string {
  const min = Math.max(1, defaultSessionDurationMin);
  return `${min} minute${min === 1 ? "" : "s"}`;
}
