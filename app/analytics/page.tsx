"use client";

import { WritingConceptFrequencyChart } from "@/components/analytics/WritingConceptFrequencyChart";
import { ConceptTrendChart } from "@/components/analytics/ConceptTrendChart";
import { MistakeLog } from "@/components/analytics/MistakeLog";
import { MockHistory } from "@/components/analytics/MockHistory";
import { ReadingDifficultyTrend } from "@/components/analytics/ReadingDifficultyTrend";
import { ReadingPacingChart } from "@/components/analytics/ReadingPacingChart";
import { ReadingPartAccuracy } from "@/components/analytics/ReadingPartAccuracy";
import { ReadingQuestionTypeAccuracy } from "@/components/analytics/ReadingQuestionTypeAccuracy";
import { ReadingStaminaCurve } from "@/components/analytics/ReadingStaminaCurve";
import { ScoreTimeline } from "@/components/analytics/ScoreTimeline";
import { SkillProfileSummary } from "@/components/analytics/SkillProfileSummary";
import { Button } from "@/components/ui/button";
import { exportAllData, importAllData } from "@/lib/storage";
import { useStudyStore } from "@/hooks/useStudyStore";

export default function AnalyticsPage() {
  const graded = useStudyStore((s) => s.graded);
  const hydrate = useStudyStore((s) => s.hydrate);

  const avgBand =
    graded.length > 0
      ? (
          graded.reduce((sum, s) => sum + s.estimatedBand, 0) / graded.length
        ).toFixed(1)
      : "—";

  const handleExport = async () => {
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `celpip-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export data.");
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      if (await importAllData(text)) {
        await hydrate();
        alert("Data imported successfully.");
      } else {
        alert("Failed to import data. Check the file format.");
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-sm text-gray-600">
            Track CLB band progress and review recurring mistakes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            Export Backup
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport}>
            Import Backup
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Sessions Graded</p>
          <p className="text-3xl font-bold text-gray-900">{graded.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Average CLB Band</p>
          <p className="text-3xl font-bold text-blue-600">{avgBand}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Target</p>
          <p className="text-3xl font-bold text-green-600">CLB 9+</p>
        </div>
      </div>

      <ScoreTimeline />
      <SkillProfileSummary />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Writing diagnostics
          </h2>
          <p className="text-sm text-gray-600">
            Which concepts show up most in your writing feedback — compare
            exercises flagged (breadth) vs total mistake instances (volume).
          </p>
        </div>
        <WritingConceptFrequencyChart />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Reading diagnostics
          </h2>
          <p className="text-sm text-gray-600">
            Where you struggle in reading, broken down by CELPIP Part, question
            type, pacing, and stamina.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ReadingPartAccuracy />
          <ReadingQuestionTypeAccuracy />
          <ReadingPacingChart />
          <ReadingStaminaCurve />
        </div>
        <ReadingDifficultyTrend />
      </section>

      <MockHistory />
      <ConceptTrendChart />
      <MistakeLog />
    </div>
  );
}
