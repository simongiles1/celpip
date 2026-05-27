"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExerciseKindBadge } from "@/components/session/ExerciseKindBadge";
import { useStudyStore } from "@/hooks/useStudyStore";
import {
  formatMockDuration,
  getMockSpec,
  MOCK_SPECS_BY_SUBTEST,
  type MockSpec,
} from "@/lib/celpip-mocks";

interface MockAttemptRow {
  attemptId: string;
  specId: string;
  spec: MockSpec | undefined;
  estimatedBand: number;
  gradedAt: string;
}

function MockCard({ spec }: { spec: MockSpec }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">{spec.label}</p>
        <p className="mt-1 text-xs text-gray-500">{spec.description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{formatMockDuration(spec.totalTimeSec)}</Badge>
        <Badge variant="outline">{spec.subTest}</Badge>
        {spec.kind === "reading_full" && (
          <Badge variant="secondary">38 questions</Badge>
        )}
      </div>
      <div className="flex shrink-0 justify-end">
        <Link href={`/practice-tests/${spec.id}`}>
          <Button size="sm">Start mock</Button>
        </Link>
      </div>
    </div>
  );
}

export default function PracticeTestsPage() {
  const graded = useStudyStore((s) => s.graded);

  const attempts = useMemo<MockAttemptRow[]>(() => {
    const byAttempt = new Map<
      string,
      { specId: string; estimatedBand: number; gradedAt: string; segments: number }
    >();
    for (const session of graded) {
      if (!session.isMock || !session.mockSpecId) continue;
      const attemptId = session.eventId.split("-seg-")[0];
      const existing = byAttempt.get(attemptId);
      if (existing) {
        existing.estimatedBand += session.estimatedBand;
        existing.segments++;
        if (
          new Date(session.gradedAt).getTime() >
          new Date(existing.gradedAt).getTime()
        ) {
          existing.gradedAt = session.gradedAt;
        }
      } else {
        byAttempt.set(attemptId, {
          specId: session.mockSpecId,
          estimatedBand: session.estimatedBand,
          gradedAt: session.gradedAt,
          segments: 1,
        });
      }
    }
    return Array.from(byAttempt.entries())
      .map(([attemptId, data]) => ({
        attemptId,
        specId: data.specId,
        spec: getMockSpec(data.specId),
        estimatedBand: data.estimatedBand / data.segments,
        gradedAt: data.gradedAt,
      }))
      .sort(
        (a, b) =>
          new Date(b.gradedAt).getTime() - new Date(a.gradedAt).getTime(),
      )
      .slice(0, 8);
  }, [graded]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ExerciseKindBadge kind="celpip_mock" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Practice Tests</h1>
        <p className="text-sm text-gray-600">
          Official-format CELPIP mocks with strict timing and scoring. No
          scaffolding, no hints. Use these to gauge exam readiness.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reading</CardTitle>
          <CardDescription>
            Per-part mocks (Part 1-4) and a full 38-question reading
            sub-test. Each Part has its own 11-minute timer.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {MOCK_SPECS_BY_SUBTEST.Reading.map((spec) => (
            <MockCard key={spec.id} spec={spec} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Writing</CardTitle>
          <CardDescription>
            Single-task mocks (Task 1 email, Task 2 survey) and a full 53-minute
            back-to-back writing sub-test.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {MOCK_SPECS_BY_SUBTEST.Writing.map((spec) => (
            <MockCard key={spec.id} spec={spec} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent attempts</CardTitle>
          <CardDescription>
            Mocks you have completed. Click to view full analytics on the
            Analytics page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-sm text-gray-500">
              No mock attempts yet. Pick a mock above to get started.
            </p>
          ) : (
            <ul className="space-y-2">
              {attempts.map((a) => (
                <li
                  key={a.attemptId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-900">
                      {a.spec?.label ?? a.specId}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(a.gradedAt), "EEE MMM d, h:mm a")}
                    </p>
                  </div>
                  <Badge variant="success">
                    CLB {Math.round(a.estimatedBand)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-500">
        Mock attempts are stored alongside themed sessions and contribute to
        your analytics (accuracy by Part, by question type, pacing, and
        stamina).
      </p>
    </div>
  );
}
