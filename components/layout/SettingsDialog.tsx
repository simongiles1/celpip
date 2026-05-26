"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GeminiCostPopover } from "@/components/session/GeminiCostPopover";
import { useStudyStore } from "@/hooks/useStudyStore";
import { combineGeminiUsage } from "@/lib/gemini-session-usage";
import {
  GEMINI_MODELS,
  GEMINI_MODEL_LABELS,
  type GeminiModel,
} from "@/lib/gemini";
import {
  formatUsd,
  GEMINI_PRICING_PER_MILLION,
} from "@/lib/gemini-usage";
import { cn } from "@/lib/utils";

export function SettingsDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const geminiModel = useStudyStore((s) => s.geminiModel);
  const setGeminiModel = useStudyStore((s) => s.setGeminiModel);
  const rebuildSchedule = useStudyStore((s) => s.rebuildSchedule);
  const resetStudyProgram = useStudyStore((s) => s.resetStudyProgram);
  const settings = useStudyStore((s) => s.settings);
  const generated = useStudyStore((s) => s.generated);
  const graded = useStudyStore((s) => s.graded);

  const programUsage = useMemo(
    () =>
      combineGeminiUsage(
        geminiModel,
        ...generated.map((g) => g.geminiUsage),
        ...graded.map((g) => g.geminiUsage),
      ),
    [geminiModel, generated, graded],
  );

  const handleModelChange = (model: GeminiModel) => {
    setGeminiModel(model);
  };

  const handleRebuildSchedule = async () => {
    const confirmed = window.confirm(
      "Rebuild the study calendar from your saved exam date? Each day gets a 45-minute writing session at 9:00 and a 45-minute reading session at 10:00. Completed session statuses are kept where the same unit falls on the same day.",
    );
    if (!confirmed) return;

    setRebuilding(true);
    setRebuildError(null);
    try {
      await rebuildSchedule();
    } catch (error) {
      setRebuildError(
        error instanceof Error ? error.message : "Failed to rebuild schedule",
      );
    } finally {
      setRebuilding(false);
    }
  };

  const handleResetProgram = async () => {
    const confirmed = window.confirm(
      "Reset your entire study program? This clears your schedule, grades, and progress from the database, then sends you back to onboarding.",
    );
    if (!confirmed) return;

    setResetting(true);
    setResetError(null);
    try {
      await resetStudyProgram();
      setOpen(false);
      router.push("/onboarding");
    } catch (error) {
      setResetError(
        error instanceof Error ? error.message : "Failed to reset program",
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Settings"
        className="text-gray-600"
      >
        <Settings className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen} panelClassName="max-w-md">
        <DialogHeader
          onClose={() => setOpen(false)}
          trailing={<GeminiCostPopover usage={programUsage} />}
        >
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-gray-900">AI model</h3>
              <p className="mt-1 text-sm text-gray-500">
                Used for generating practice content and grading submissions.
              </p>
            </div>
            <div className="space-y-2">
              {GEMINI_MODELS.map((model) => {
                const pricing = GEMINI_PRICING_PER_MILLION[model];
                return (
                  <label
                    key={model}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
                      geminiModel === model
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300",
                    )}
                  >
                    <input
                      type="radio"
                      name="gemini-model"
                      value={model}
                      checked={geminiModel === model}
                      onChange={() => handleModelChange(model)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">
                        {GEMINI_MODEL_LABELS[model]}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {model} · {formatUsd(pricing.input)}/
                        {formatUsd(pricing.output)} per 1M tokens (in/out)
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {settings && (
            <section className="space-y-3 border-t border-gray-100 pt-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  Study calendar
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Rebuild events from your exam date: writing at 9:00 and
                  reading at 10:00 each day.
                </p>
              </div>
              {rebuildError && (
                <p className="text-sm text-red-600">{rebuildError}</p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleRebuildSchedule()}
                disabled={rebuilding}
              >
                {rebuilding ? "Rebuilding..." : "Rebuild schedule"}
              </Button>
            </section>
          )}

          <section className="space-y-3 border-t border-gray-100 pt-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Study program
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Start over with a new exam date. Required if visiting onboarding
                while an old program is still saved in the database.
              </p>
            </div>
            {resetError && (
              <p className="text-sm text-red-600">{resetError}</p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleResetProgram()}
              disabled={resetting}
            >
              {resetting ? "Resetting..." : "Reset study program"}
            </Button>
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
