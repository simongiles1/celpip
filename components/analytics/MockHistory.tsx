"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useStudyStore } from "@/hooks/useStudyStore";
import { getMockSpec } from "@/lib/celpip-mocks";
import {
  CELPIP_READING_PARTS,
  getMockAttemptsSummary,
} from "@/lib/reading-analytics";

function bandBadgeVariant(band: number) {
  if (band >= 9) return "success" as const;
  if (band >= 7) return "default" as const;
  return "warning" as const;
}

export function MockHistory() {
  const graded = useStudyStore((s) => s.graded);

  const attempts = useMemo(() => {
    const summaries = getMockAttemptsSummary(graded);
    const byAttempt = new Map<
      string,
      typeof summaries[number] & { segments: typeof summaries }
    >();
    for (const s of summaries) {
      const attemptId = s.eventId.split("-seg-")[0];
      const existing = byAttempt.get(attemptId);
      if (!existing) {
        byAttempt.set(attemptId, { ...s, segments: [s] });
      } else {
        existing.segments.push(s);
        if (
          new Date(s.gradedAt).getTime() > new Date(existing.gradedAt).getTime()
        ) {
          existing.gradedAt = s.gradedAt;
        }
      }
    }
    return Array.from(byAttempt.entries())
      .map(([attemptId, data]) => ({ attemptId, ...data }))
      .sort(
        (a, b) =>
          new Date(b.gradedAt).getTime() - new Date(a.gradedAt).getTime(),
      );
  }, [graded]);

  if (attempts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mock attempts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            No mock attempts yet. Run a CELPIP mock to capture exam-realistic
            data.
          </p>
          <Link href="/practice-tests">
            <Button size="sm">Open Practice Tests</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Mock attempts</CardTitle>
          <p className="text-sm text-gray-500">
            Per-Part scores from every CELPIP mock you have completed.
          </p>
        </div>
        <Link href="/practice-tests">
          <Button size="sm" variant="outline">
            New mock
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {attempts.map((attempt) => {
            const spec = getMockSpec(attempt.mockSpecId);
            const avgBand =
              attempt.segments.reduce((sum, s) => sum + s.estimatedBand, 0) /
              attempt.segments.length;
            return (
              <li
                key={attempt.attemptId}
                className="rounded-lg border border-gray-200 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {spec?.label ?? attempt.mockSpecId}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(attempt.gradedAt), "EEE MMM d, h:mm a")}{" "}
                      · {attempt.segments.length} segment
                      {attempt.segments.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Badge variant={bandBadgeVariant(avgBand)}>
                    Avg CLB {Math.round(avgBand)}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {attempt.segments.some(
                    (s) => s.focusSubTest === "Reading",
                  ) ? (
                    CELPIP_READING_PARTS.map((part) => {
                      const totals = attempt.segments.reduce(
                        (acc, s) => {
                          const bucket = s.partBreakdown[part];
                          if (bucket) {
                            acc.correct += bucket.correct;
                            acc.total += bucket.total;
                          }
                          return acc;
                        },
                        { correct: 0, total: 0 },
                      );
                      if (totals.total === 0) return null;
                      return (
                        <Badge key={part} variant="outline">
                          {part.replace("part_", "P")}:{" "}
                          {totals.correct}/{totals.total}
                        </Badge>
                      );
                    })
                  ) : (
                    <Badge variant="outline">Writing</Badge>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
