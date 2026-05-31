"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudyStore } from "@/hooks/useStudyStore";
import { getConceptById } from "@/lib/skill-profile";

interface MistakeEntry {
  text: string;
  count: number;
  subTest: string;
  type: "criticism" | "grammar";
  conceptId?: string;
  conceptLabel?: string;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export function MistakeLog() {
  const graded = useStudyStore((s) => s.graded);
  const skillProfile = useStudyStore((s) => s.skillProfile);

  const { byConcept, ungrouped } = useMemo(() => {
    const map = new Map<string, MistakeEntry>();
    const conceptGroups = new Map<string, MistakeEntry[]>();

    for (const session of graded) {
      for (const item of session.constructiveCriticism) {
        const key = `c:${normalize(item)}`;
        const existing = map.get(key);
        const entry: MistakeEntry = existing ?? {
          text: item,
          count: 0,
          subTest: session.focusSubTest,
          type: "criticism",
        };
        entry.count++;
        map.set(key, entry);
      }

      for (const fix of session.grammarCorrections) {
        const text = `${fix.original} → ${fix.corrected} (${fix.reason})`;
        const key = `g:${normalize(text)}`;
        const existing = map.get(key);
        const entry: MistakeEntry = existing ?? {
          text,
          count: 0,
          subTest: session.focusSubTest,
          type: "grammar",
        };
        entry.count++;
        map.set(key, entry);
      }
    }

    for (const obs of skillProfile.observations) {
      if (obs.polarity !== "weakness") continue;
      const concept = getConceptById(skillProfile, obs.conceptId);
      const groupKey = obs.conceptId;
      const groups = conceptGroups.get(groupKey) ?? [];
      const existing = groups.find((g) => normalize(g.text) === normalize(obs.evidence));
      if (existing) {
        existing.count++;
      } else {
        groups.push({
          text: obs.evidence,
          count: 1,
          subTest: obs.track === "concept" ? "Concept" : "Tagged",
          type: "grammar",
          conceptId: obs.conceptId,
          conceptLabel: concept?.label,
        });
      }
      conceptGroups.set(groupKey, groups);
    }

    const all = Array.from(map.values()).sort((a, b) => b.count - a.count);
    return {
      byConcept: Array.from(conceptGroups.entries())
        .map(([conceptId, entries]) => ({
          conceptId,
          label: getConceptById(skillProfile, conceptId)?.label ?? conceptId,
          entries: entries.sort((a, b) => b.count - a.count),
          total: entries.reduce((sum, e) => sum + e.count, 0),
        }))
        .sort((a, b) => b.total - a.total),
      ungrouped: all.slice(0, 10),
    };
  }, [graded, skillProfile]);

  if (ungrouped.length === 0 && byConcept.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mistake Log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Flagged issues from graded sessions will appear here to guide targeted revision.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mistake Log</CardTitle>
        <p className="text-sm text-gray-500">
          Recurring issues grouped by concept — practice weak areas in{" "}
          <Link href="/concepts" className="text-blue-600 hover:underline">
            Concept Lab
          </Link>
          .
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {byConcept.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">By Concept</h3>
            {byConcept.map((group) => (
              <div key={group.conceptId} className="rounded-lg border border-purple-200 bg-purple-50/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Link
                    href={`/concepts?practice=${encodeURIComponent(group.conceptId)}`}
                    className="font-medium text-purple-900 hover:underline"
                  >
                    {group.label}
                  </Link>
                  <Badge>{group.total}×</Badge>
                </div>
                <ul className="space-y-2">
                  {group.entries.slice(0, 3).map((entry) => (
                    <li key={entry.text} className="text-sm text-gray-700">
                      {entry.text}
                      {entry.count > 1 && (
                        <span className="ml-2 text-xs text-gray-500">({entry.count}×)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Top Recurring Issues</h3>
          {ungrouped.map((entry) => (
            <div
              key={entry.text}
              className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{entry.subTest}</Badge>
                  <Badge variant={entry.type === "grammar" ? "warning" : "secondary"}>
                    {entry.type === "grammar" ? "Grammar" : "Feedback"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-800">{entry.text}</p>
              </div>
              <Badge className="shrink-0">{entry.count}×</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
