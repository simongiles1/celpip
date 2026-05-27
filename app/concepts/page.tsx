"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConceptSessionModal } from "@/components/session/ConceptSessionModal";
import { useStudyStore } from "@/hooks/useStudyStore";
import {
  getAllConcepts,
  getObservationsForConcept,
  getRecommendedConcepts,
  getStrongConcepts,
  getWeakConcepts,
} from "@/lib/skill-profile";
import {
  CELPIP_READING_PART_LABELS,
  CELPIP_READING_PARTS,
  getReadingAccuracyByPart,
  type AccuracyBucket,
} from "@/lib/reading-analytics";
import type { CelpipReadingPart } from "@/lib/types";

function MasteryBar({ mastery }: { mastery: number }) {
  const color =
    mastery >= 70 ? "bg-green-500" : mastery >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-2 w-full rounded-full bg-gray-200">
      <div
        className={`h-2 rounded-full ${color}`}
        style={{ width: `${mastery}%` }}
      />
    </div>
  );
}

function ConceptCard({
  label,
  category,
  mastery,
  trend,
  evidence,
  onPractice,
}: {
  label: string;
  category: string;
  mastery: number;
  trend?: string;
  evidence?: string;
  onPractice: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant="outline">{category}</Badge>
            {trend && <Badge variant="secondary">{trend}</Badge>}
          </div>
        </div>
        <span className="text-sm font-semibold text-gray-700">{mastery}%</span>
      </div>
      <MasteryBar mastery={mastery} />
      {evidence && (
        <p className="text-xs text-gray-500 italic">&ldquo;{evidence}&rdquo;</p>
      )}
      <Button size="sm" onClick={onPractice}>
        Practice
      </Button>
    </div>
  );
}

function partToMockSpecId(part: CelpipReadingPart): string {
  return `mock-reading-${part}`;
}

export default function ConceptsPage() {
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const graded = useStudyStore((s) => s.graded);
  const scheduleConceptDrill = useStudyStore((s) => s.scheduleConceptDrill);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);

  const weak = getWeakConcepts(skillProfile, 8);
  const strong = getStrongConcepts(skillProfile, 5);
  const recommended = getRecommendedConcepts(skillProfile, 3);
  const allConcepts = getAllConcepts(skillProfile);

  const weakParts = useMemo<
    Array<{ part: CelpipReadingPart; bucket: AccuracyBucket }>
  >(() => {
    const byPart = getReadingAccuracyByPart(graded);
    return CELPIP_READING_PARTS.filter((p) => byPart[p].total >= 5)
      .map((p) => ({ part: p, bucket: byPart[p] }))
      .filter(({ bucket }) => bucket.pct < 0.8)
      .sort((a, b) => a.bucket.pct - b.bucket.pct)
      .slice(0, 3);
  }, [graded]);

  const hasData = graded.length > 0 || skillProfile.observations.length > 0;

  const handleSchedule = (conceptId: string, label: string) => {
    const { start } = scheduleConceptDrill(conceptId);
    setScheduleNotice(
      `"${label}" scheduled for ${format(start, "EEE, MMM d 'at' h:mm a")}. View it on the Calendar.`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Concept Lab</h1>
          <p className="text-sm text-gray-600">
            Targeted micro-skill drills separate from full Reading & Writing sessions.
          </p>
        </div>
        <Link href="/analytics">
          <Button variant="outline" size="sm">
            View Analytics
          </Button>
        </Link>
      </div>

      {scheduleNotice && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <span>{scheduleNotice}</span>
          <div className="flex gap-2">
            <Link href="/">
              <Button size="sm" variant="outline">
                Open Calendar
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setScheduleNotice(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {!hasData && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-gray-500">
              Complete a few graded sessions first. The app will identify your strengths
              and weaknesses and recommend concept drills here. You can still practice any
              concept below.
            </p>
            <Link href="/">
              <Button className="mt-4" size="sm">
                Go to Calendar
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {recommended.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommended Next</CardTitle>
            <p className="text-sm text-gray-500">
              Weak areas not practiced in the last 7 days
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {recommended.map(({ concept, score }) => {
              const obs = getObservationsForConcept(skillProfile, concept.id, 1)[0];
              return (
                <ConceptCard
                  key={concept.id}
                  label={concept.label}
                  category={concept.category}
                  mastery={score.mastery}
                  trend={score.trend}
                  evidence={obs?.evidence}
                  onPractice={() => setActiveConceptId(concept.id)}
                />
              );
            })}
          </CardContent>
        </Card>
      )}

      {weakParts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Weak CELPIP Reading Parts</CardTitle>
            <p className="text-sm text-gray-500">
              These reading parts have accuracy below 80% across your last few
              sessions. Run the strict mock version to harden them.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {weakParts.map(({ part, bucket }) => (
              <div
                key={part}
                className="space-y-3 rounded-lg border border-gray-200 p-4"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {CELPIP_READING_PART_LABELS[part]}
                  </p>
                  <p className="text-xs text-gray-500">
                    {bucket.correct}/{bucket.total} correct ·{" "}
                    {Math.round(bucket.pct * 100)}% accuracy
                  </p>
                </div>
                <Link href={`/practice-tests/${partToMockSpecId(part)}`}>
                  <Button size="sm">Run mock</Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs Work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {weak.length === 0 ? (
              <p className="text-sm text-gray-500">
                No weakness patterns detected yet.
              </p>
            ) : (
              weak.map(({ concept, score }) => {
                const obs = getObservationsForConcept(skillProfile, concept.id, 1).find(
                  (o) => o.polarity === "weakness",
                );
                return (
                  <ConceptCard
                    key={concept.id}
                    label={concept.label}
                    category={concept.category}
                    mastery={score.mastery}
                    trend={score.trend}
                    evidence={obs?.evidence}
                    onPractice={() => setActiveConceptId(concept.id)}
                  />
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {strong.length === 0 ? (
              <p className="text-sm text-gray-500">
                Strengths will appear as you complete more sessions.
              </p>
            ) : (
              strong.map(({ concept, score }) => (
                <ConceptCard
                  key={concept.id}
                  label={concept.label}
                  category={concept.category}
                  mastery={score.mastery}
                  trend={score.trend}
                  onPractice={() => setActiveConceptId(concept.id)}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Concepts</CardTitle>
          <p className="text-sm text-gray-500">
            {allConcepts.length} concepts ({skillProfile.discoveredConcepts.length}{" "}
            discovered from your sessions)
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allConcepts.map((concept) => {
            const score = skillProfile.conceptScores.find(
              (s) => s.conceptId === concept.id,
            );
            return (
              <div
                key={concept.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{concept.label}</p>
                  <p className="text-xs text-gray-500">
                    {concept.source === "discovered" ? "Discovered" : "Core"} ·{" "}
                    {score ? `${score.mastery}%` : "Not yet observed"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => setActiveConceptId(concept.id)}>
                    Practice
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSchedule(concept.id, concept.label)}
                  >
                    Schedule
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <ConceptSessionModal
        conceptId={activeConceptId}
        onClose={() => setActiveConceptId(null)}
      />
    </div>
  );
}
