"use client";

import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { AnnotatedWritingReview } from "@/components/session/AnnotatedWritingReview";
import { CopyForVerificationButton } from "@/components/session/CopyForVerificationButton";
import { PracticeRecommendations } from "@/components/session/PracticeRecommendations";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatWritingVerificationCopy } from "@/lib/copy-for-verification";
import { getConceptById, getPracticeRecommendations } from "@/lib/skill-profile";
import type { GradeResponse, UserSkillProfile } from "@/lib/types";

interface GradingResultsProps {
  result: GradeResponse;
  studentResponse?: string;
  verificationCopy?: {
    testLabel: string;
    examPrompt: string;
    studentResponse: string;
  };
  eventId?: string;
  skillProfile?: UserSkillProfile;
  onPracticeConcept?: (conceptId: string) => void;
}

export function GradingResults({
  result,
  studentResponse,
  verificationCopy,
  eventId,
  skillProfile,
  onPracticeConcept,
}: GradingResultsProps) {
  const responseText = studentResponse ?? verificationCopy?.studentResponse ?? "";
  const practiceRecommendations = skillProfile
    ? getPracticeRecommendations(skillProfile, {
        eventId,
        skillTags: result.skillTags,
      })
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-600">Estimated CLB Band</span>
        <Badge variant="success" className="text-base px-3 py-1">
          {result.estimatedBand}
        </Badge>
        {verificationCopy && (
          <CopyForVerificationButton
            getText={() =>
              formatWritingVerificationCopy({
                testLabel: verificationCopy.testLabel,
                examPrompt: verificationCopy.examPrompt,
                studentResponse: verificationCopy.studentResponse,
                grade: result,
              })
            }
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overall Feedback</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <ReactMarkdown>{result.overallFeedback}</ReactMarkdown>
        </CardContent>
      </Card>

      {result.positives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-green-700">Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
              {result.positives.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result.constructiveCriticism.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-amber-700">Areas to Improve</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
              {result.constructiveCriticism.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {skillProfile &&
        responseText &&
        result.grammarCorrections.length > 0 && (
          <AnnotatedWritingReview
            studentResponse={responseText}
            corrections={result.grammarCorrections}
            skillProfile={skillProfile}
            skillTags={result.skillTags}
            onPracticeConcept={onPracticeConcept}
          />
        )}

      {skillProfile && practiceRecommendations.length > 0 && (
        <PracticeRecommendations
          skillProfile={skillProfile}
          eventId={eventId}
          skillTags={result.skillTags}
          onPracticeConcept={onPracticeConcept}
        />
      )}

      {skillProfile &&
        result.constructiveCriticism.length > 0 &&
        practiceRecommendations.length === 0 && (
          <Card className="border-purple-200 bg-purple-50/20">
            <CardHeader>
              <CardTitle className="text-base text-purple-950">
                Next Step: Concept Lab
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-700">
              <p>
                To turn this feedback into practice, open Concept Lab and work
                through drills for the skills listed above.
              </p>
              <Link href="/concepts" className="text-blue-600 hover:underline">
                Open Concept Lab
              </Link>
            </CardContent>
          </Card>
        )}

      {result.grammarCorrections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Grammar Corrections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.grammarCorrections.map((fix) => (
              <div
                key={`${fix.original}-${fix.corrected}`}
                className="rounded-lg border border-gray-200 p-3 text-sm"
              >
                <p>
                  <span className="text-red-600 line-through">{fix.original}</span>
                  {" → "}
                  <span className="text-green-700 font-medium">{fix.corrected}</span>
                </p>
                <p className="mt-1 text-gray-500">{fix.reason}</p>
                {fix.conceptId && skillProfile && (
                  <p className="mt-2 text-xs text-purple-800">
                    Concept:{" "}
                    {onPracticeConcept ? (
                      <button
                        type="button"
                        className="cursor-pointer font-medium underline-offset-2 hover:underline"
                        onClick={() => onPracticeConcept(fix.conceptId!)}
                      >
                        {getConceptById(skillProfile, fix.conceptId)?.label ??
                          fix.conceptId.replace(/_/g, " ")}
                      </button>
                    ) : (
                      <Link
                        href={`/concepts?practice=${encodeURIComponent(fix.conceptId)}`}
                        className="font-medium hover:underline"
                      >
                        {getConceptById(skillProfile, fix.conceptId)?.label ??
                          fix.conceptId.replace(/_/g, " ")}
                      </Link>
                    )}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
