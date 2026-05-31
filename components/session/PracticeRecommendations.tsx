"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPracticeRecommendations,
  type PracticeRecommendation,
} from "@/lib/skill-profile";
import type { SkillTag, UserSkillProfile } from "@/lib/types";

interface PracticeRecommendationsProps {
  skillProfile: UserSkillProfile;
  eventId?: string;
  skillTags?: SkillTag[];
  onPracticeConcept?: (conceptId: string) => void;
}

function RecommendationRow({
  item,
  onPracticeConcept,
}: {
  item: PracticeRecommendation;
  onPracticeConcept?: (conceptId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-purple-950">{item.label}</p>
          <p className="text-sm text-gray-700">{item.description}</p>
          {item.evidence && (
            <p className="text-xs italic text-gray-500">
              From your writing: &ldquo;{item.evidence}&rdquo;
            </p>
          )}
        </div>
        {onPracticeConcept ? (
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => onPracticeConcept(item.conceptId)}
          >
            Practice now
          </Button>
        ) : (
          <Link
            href={`/concepts?practice=${encodeURIComponent(item.conceptId)}`}
            className="shrink-0"
          >
            <Button size="sm">Practice in Concept Lab</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

export function PracticeRecommendations({
  skillProfile,
  eventId,
  skillTags,
  onPracticeConcept,
}: PracticeRecommendationsProps) {
  const recommendations = getPracticeRecommendations(skillProfile, {
    eventId,
    skillTags,
  });

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <Card className="border-purple-200 bg-purple-50/20">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base text-purple-950">
            Practice These Skills
          </CardTitle>
          <Badge variant="outline">{recommendations.length}</Badge>
        </div>
        <p className="text-sm text-gray-600">
          Corrections explain the mistake — Concept Lab drills help you use the
          pattern correctly. Start with the concepts tied to your feedback below.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((item) => (
          <RecommendationRow
            key={item.conceptId}
            item={item}
            onPracticeConcept={onPracticeConcept}
          />
        ))}
      </CardContent>
    </Card>
  );
}
