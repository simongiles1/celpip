"use client";

import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GradeResponse } from "@/lib/types";

interface GradingResultsProps {
  result: GradeResponse;
}

export function GradingResults({ result }: GradingResultsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-600">Estimated CLB Band</span>
        <Badge variant="success" className="text-base px-3 py-1">
          {result.estimatedBand}
        </Badge>
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

      {result.grammarCorrections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grammar Corrections</CardTitle>
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
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
