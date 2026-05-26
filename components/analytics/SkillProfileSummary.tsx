"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudyStore } from "@/hooks/useStudyStore";
import {
  getConceptById,
  getStrongConcepts,
  getWeakConcepts,
} from "@/lib/skill-profile";

export function SkillProfileSummary() {
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const weak = getWeakConcepts(skillProfile, 5);
  const strong = getStrongConcepts(skillProfile, 5);

  const avgMastery =
    skillProfile.conceptScores.length > 0
      ? Math.round(
          skillProfile.conceptScores.reduce((sum, s) => sum + s.mastery, 0) /
            skillProfile.conceptScores.length,
        )
      : null;

  if (skillProfile.observations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Skill Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Complete graded sessions to build your personalized skill profile.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Skill Profile</CardTitle>
          {avgMastery !== null && (
            <p className="text-sm text-gray-500">
              Average mastery across tracked concepts: {avgMastery}%
            </p>
          )}
        </div>
        <Link href="/concepts">
          <Button size="sm" variant="outline">
            Concept Lab
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-red-700">Needs Work</h3>
          <ul className="space-y-2">
            {weak.length === 0 ? (
              <li className="text-sm text-gray-500">No major weaknesses flagged.</li>
            ) : (
              weak.map(({ concept, score }) => (
                <li
                  key={concept.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{concept.label}</p>
                    <p className="text-xs text-gray-500">
                      {score.weaknessCount} issue{score.weaknessCount !== 1 ? "s" : ""} ·{" "}
                      {score.trend}
                    </p>
                  </div>
                  <Badge variant="warning">{score.mastery}%</Badge>
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-green-700">Strengths</h3>
          <ul className="space-y-2">
            {strong.length === 0 ? (
              <li className="text-sm text-gray-500">Keep practicing to identify strengths.</li>
            ) : (
              strong.map(({ concept, score }) => (
                <li
                  key={concept.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{concept.label}</p>
                    <p className="text-xs text-gray-500">
                      {score.strengthCount} positive signal
                      {score.strengthCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Badge variant="success">{score.mastery}%</Badge>
                </li>
              ))
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function getConceptLabelForObservation(
  skillProfile: ReturnType<typeof useStudyStore.getState>["skillProfile"],
  conceptId: string,
): string {
  return getConceptById(skillProfile, conceptId)?.label ?? conceptId.replace(/_/g, " ");
}
