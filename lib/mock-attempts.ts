import { getMockSpec, READING_PART_LABEL, type MockSpec } from "@/lib/celpip-mocks";
import type { GradedSession } from "@/lib/types";

export function parseMockSegmentIndex(eventId: string): number {
  const match = eventId.match(/-seg-(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

export function parseMockAttemptId(eventId: string): string {
  return eventId.split("-seg-")[0];
}

export function getMockAttemptSegments(
  graded: GradedSession[],
  attemptId: string,
): GradedSession[] {
  return graded
    .filter((s) => s.isMock && parseMockAttemptId(s.eventId) === attemptId)
    .sort(
      (a, b) =>
        parseMockSegmentIndex(a.eventId) - parseMockSegmentIndex(b.eventId),
    );
}

export function getMockSegmentLabel(
  spec: MockSpec,
  segmentIndex: number,
): string {
  if (spec.readingSegments) {
    const seg = spec.readingSegments[segmentIndex];
    if (!seg) return `Segment ${segmentIndex + 1}`;
    return READING_PART_LABEL[seg.celpipPart];
  }
  const seg = spec.writingSegments?.[segmentIndex];
  if (!seg) return `Segment ${segmentIndex + 1}`;
  return seg.task === "task_1"
    ? "Task 1 — Email"
    : "Task 2 — Survey Opinion";
}

export interface MockAttemptOverview {
  attemptId: string;
  mockSpecId: string;
  spec: MockSpec | undefined;
  segments: GradedSession[];
  avgBand: number;
  gradedAt: string;
}

export function getMockAttemptOverview(
  graded: GradedSession[],
  attemptId: string,
): MockAttemptOverview | null {
  const segments = getMockAttemptSegments(graded, attemptId);
  if (segments.length === 0) return null;

  const mockSpecId = segments[0].mockSpecId ?? segments[0].curriculumUnitId;
  const avgBand =
    segments.reduce((sum, s) => sum + s.estimatedBand, 0) / segments.length;
  const gradedAt = segments.reduce(
    (latest, s) =>
      new Date(s.gradedAt).getTime() > new Date(latest).getTime()
        ? s.gradedAt
        : latest,
    segments[0].gradedAt,
  );

  return {
    attemptId,
    mockSpecId,
    spec: getMockSpec(mockSpecId),
    segments,
    avgBand,
    gradedAt,
  };
}
