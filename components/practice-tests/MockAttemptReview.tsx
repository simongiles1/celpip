"use client";

import Link from "next/link";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { ExerciseKindBadge } from "@/components/session/ExerciseKindBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useStudyStore } from "@/hooks/useStudyStore";
import {
  getMockAttemptOverview,
  getMockSegmentLabel,
  parseMockSegmentIndex,
} from "@/lib/mock-attempts";
import {
  CELPIP_READING_PARTS,
  getReadingResults,
} from "@/lib/reading-analytics";
import { getReadingGradeMetadata } from "@/lib/reading-submission";
import type { GradedSession } from "@/lib/types";

function bandBadgeVariant(band: number) {
  if (band >= 9) return "success" as const;
  if (band >= 7) return "default" as const;
  return "warning" as const;
}

function ReadingSegmentScores({ session }: { session: GradedSession }) {
  const metadata = getReadingGradeMetadata(session.studentSubmission);
  const readingResults = getReadingResults(session);

  return (
    <div className="flex flex-col gap-3">
      {metadata && (
        <Badge variant="outline">
          {metadata.score.correct}/{metadata.score.total} correct
        </Badge>
      )}

      {session.overallFeedback.trim() && (
        <div className="rounded-lg border border-gray-200 px-3 py-2">
          <h4 className="text-xs font-semibold text-gray-700">
            Overall feedback
          </h4>
          <div className="prose prose-sm mt-1 max-w-none [&>:first-child]:mt-0">
            <ReactMarkdown>{session.overallFeedback}</ReactMarkdown>
          </div>
        </div>
      )}

      {readingResults.length > 0 && (
        <details className="rounded-lg border border-gray-200 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-gray-700">
            Per-question results ({readingResults.filter((r) => r.isCorrect).length}/
            {readingResults.length} correct)
          </summary>
          <ul className="mt-2 space-y-2 text-xs">
            {readingResults.map((r) => (
              <li
                key={r.index}
                className="rounded-md border border-gray-100 px-2 py-1.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900">
                    Q{r.index + 1}
                  </span>
                  <Badge variant={r.isCorrect ? "success" : "warning"}>
                    {r.isCorrect ? "Correct" : "Incorrect"}
                  </Badge>
                </div>
                {!r.isCorrect && (
                  <p className="mt-1 text-gray-600">
                    Your answer: {r.studentAnswer}
                  </p>
                )}
                <p className="mt-1 text-gray-600">{r.feedback}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function WritingSegmentScores({ session }: { session: GradedSession }) {
  const writingText =
    typeof session.studentSubmission === "string"
      ? session.studentSubmission
      : "";

  return (
    <div className="flex flex-col gap-3">
      {session.overallFeedback.trim() && (
        <div className="rounded-lg border border-gray-200 px-3 py-2">
          <h4 className="text-xs font-semibold text-gray-700">
            Overall feedback
          </h4>
          <div className="prose prose-sm mt-1 max-w-none [&>:first-child]:mt-0">
            <ReactMarkdown>{session.overallFeedback}</ReactMarkdown>
          </div>
        </div>
      )}

      {session.positives.length > 0 && (
        <div className="rounded-lg border border-gray-200 px-3 py-2">
          <h4 className="text-xs font-semibold text-green-700">Strengths</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-gray-700">
            {session.positives.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {session.constructiveCriticism.length > 0 && (
        <div className="rounded-lg border border-gray-200 px-3 py-2">
          <h4 className="text-xs font-semibold text-amber-700">
            Areas to improve
          </h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-gray-700">
            {session.constructiveCriticism.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {session.grammarCorrections.length > 0 && (
        <div className="rounded-lg border border-gray-200 px-3 py-2">
          <h4 className="text-xs font-semibold text-gray-700">
            Grammar corrections
          </h4>
          <div className="mt-2 space-y-2">
            {session.grammarCorrections.map((fix) => (
              <div key={`${fix.original}-${fix.corrected}`} className="text-xs">
                <p>
                  <span className="text-red-600 line-through">{fix.original}</span>
                  {" → "}
                  <span className="font-medium text-green-700">
                    {fix.corrected}
                  </span>
                </p>
                <p className="mt-0.5 text-gray-500">{fix.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {writingText && (
        <details className="rounded-lg border border-gray-200 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-gray-700">
            Your response
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-xs text-gray-700">
            {writingText}
          </p>
        </details>
      )}
    </div>
  );
}

export function MockAttemptReview({ attemptId }: { attemptId: string }) {
  const graded = useStudyStore((s) => s.graded);
  const overview = getMockAttemptOverview(graded, attemptId);

  if (!overview) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Attempt not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              This mock attempt could not be found. It may have been cleared or
              the link is invalid.
            </p>
            <Link href="/practice-tests">
              <Button variant="outline" size="sm">
                Back to Practice Tests
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { spec, segments, avgBand, gradedAt } = overview;
  const hasReading = segments.some((s) => s.focusSubTest === "Reading");

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ExerciseKindBadge kind="celpip_mock" />
          <Link href="/practice-tests">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              ← Practice Tests
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {spec?.label ?? overview.mockSpecId}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {format(new Date(gradedAt), "EEEE, MMMM d, yyyy · h:mm a")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overall score</CardTitle>
          <CardDescription>
            {segments.length} segment{segments.length !== 1 ? "s" : ""} graded
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge variant={bandBadgeVariant(avgBand)} className="text-base px-3 py-1">
            Avg CLB {Math.round(avgBand)}
          </Badge>
          {hasReading && (
            <div className="flex flex-wrap gap-2">
              {CELPIP_READING_PARTS.map((part) => {
                const totals = segments.reduce(
                  (acc, s) => {
                    for (const r of getReadingResults(s)) {
                      if (r.celpipPart !== part) continue;
                      acc.correct += r.isCorrect ? 1 : 0;
                      acc.total++;
                    }
                    return acc;
                  },
                  { correct: 0, total: 0 },
                );
                if (totals.total === 0) return null;
                return (
                  <Badge key={part} variant="outline">
                    {part.replace("part_", "Part ")}: {totals.correct}/
                    {totals.total}
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Segment scores</h2>
        {segments.map((session) => {
          const segmentIndex = parseMockSegmentIndex(session.eventId);
          const label =
            spec != null
              ? getMockSegmentLabel(spec, segmentIndex)
              : `Segment ${segmentIndex + 1}`;

          return (
            <Card key={session.eventId}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle className="text-base">{label}</CardTitle>
                  <Badge variant={bandBadgeVariant(session.estimatedBand)}>
                    CLB {session.estimatedBand}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {session.focusSubTest === "Reading" ? (
                  <ReadingSegmentScores session={session} />
                ) : (
                  <WritingSegmentScores session={session} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
