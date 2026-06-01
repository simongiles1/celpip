"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GeminiCostPopover } from "@/components/session/GeminiCostPopover";
import { VocabularyPractice } from "@/components/session/VocabularyPractice";
import { Skeleton } from "@/components/ui/skeleton";
import { useSelectedEvent, useStudyStore } from "@/hooks/useStudyStore";
import type { GeminiCostBreakdown } from "@/lib/gemini-usage";
import type { VocabularyProgress, VocabularyWord } from "@/lib/types";
import { prepareVocabularyWordsForPractice } from "@/lib/vocabulary-progress";
import { hasValidVocabularyPractice } from "@/lib/vocabulary-validation";

function VocabularyModalContent({
  eventId,
  sessionDate,
  onUsageChange,
}: {
  eventId: string;
  sessionDate: string;
  onUsageChange: (usage: GeminiCostBreakdown | null) => void;
}) {
  const geminiModel = useStudyStore((s) => s.geminiModel);
  const dailyVocabularyWordCount = useStudyStore(
    (s) => s.dailyVocabularyWordCount,
  );
  const getGeneratedForEvent = useStudyStore((s) => s.getGeneratedForEvent);
  const addGenerated = useStudyStore((s) => s.addGenerated);
  const updateVocabularyProgress = useStudyStore((s) => s.updateVocabularyProgress);
  const markEventCompleted = useStudyStore((s) => s.markEventCompleted);
  const removeGeneratedForEvent = useStudyStore(
    (s) => s.removeGeneratedForEvent,
  );

  const cached = getGeneratedForEvent(eventId);
  const [words, setWords] = useState<VocabularyWord[]>(() =>
    prepareVocabularyWordsForPractice(
      cached?.vocabularyWords ?? [],
      eventId,
      cached?.vocabularyProgress,
    ),
  );
  const [loading, setLoading] = useState(!cached?.vocabularyWords?.length);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const needsRegeneration =
    words.length > 0 && !hasValidVocabularyPractice(words);

  const fetchWords = useCallback(
    async (replaceCache: boolean) => {
      setLoading(true);
      setError(null);
      onUsageChange(null);
      try {
        const response = await fetch("/api/vocabulary/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wordCount: dailyVocabularyWordCount,
            sessionDate,
            model: geminiModel,
          }),
        });
        const data = (await response.json()) as {
          words?: VocabularyWord[];
          geminiUsage?: GeminiCostBreakdown;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to generate vocabulary");
        }
        const nextWords = data.words ?? [];
        setWords(nextWords);
        onUsageChange(data.geminiUsage ?? null);

        if (replaceCache) {
          removeGeneratedForEvent(eventId);
        }
        addGenerated({
          eventId,
          instructions: "Daily vocabulary for CELPIP writing at CLB 9.",
          example: "",
          examPrompt: "",
          vocabularyWords: nextWords,
          generatedAt: new Date().toISOString(),
          geminiUsage: data.geminiUsage,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load vocabulary",
        );
      } finally {
        setLoading(false);
        setRegenerating(false);
      }
    },
    [
      addGenerated,
      dailyVocabularyWordCount,
      eventId,
      geminiModel,
      onUsageChange,
      removeGeneratedForEvent,
      sessionDate,
    ],
  );

  useEffect(() => {
    if (!cached?.vocabularyWords?.length) {
      void fetchWords(false);
      return;
    }

    if (!hasValidVocabularyPractice(cached.vocabularyWords)) {
      void fetchWords(true);
      return;
    }

    onUsageChange(cached.geminiUsage ?? null);
  }, [cached, fetchWords, onUsageChange]);

  const handleComplete = () => {
    markEventCompleted(eventId);
  };

  const handleProgressChange = useCallback(
    (progress: VocabularyProgress) => {
      updateVocabularyProgress(eventId, progress);
    },
    [eventId, updateVocabularyProgress],
  );

  if (loading && words.length === 0) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  if (error && words.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <Button type="button" onClick={() => void fetchWords(false)}>
          Retry
        </Button>
      </div>
    );
  }

  if (needsRegeneration) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Updating this session to the new practice format...
        </p>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <VocabularyPractice
        key={words
          .map((word) => `${word.word}:${word.questions?.length ?? 0}`)
          .join("|")}
        words={words}
        initialProgress={cached?.vocabularyProgress}
        onProgressChange={handleProgressChange}
        onComplete={handleComplete}
      />

      <div className="border-t border-gray-100 pt-3">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={regenerating}
          onClick={() => {
            setRegenerating(true);
            void fetchWords(true);
          }}
        >
          {regenerating ? "Generating new words..." : "Generate new word set"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function VocabularyModal() {
  const selectedEventId = useStudyStore((s) => s.selectedEventId);
  const setSelectedEventId = useStudyStore((s) => s.setSelectedEventId);
  const { event, unit } = useSelectedEvent();
  const [sessionUsage, setSessionUsage] = useState<GeminiCostBreakdown | null>(
    null,
  );

  const isVocabulary = unit?.focusSubTest === "Vocabulary";
  const open = Boolean(selectedEventId && event && unit && isVocabulary);

  useEffect(() => {
    if (!open) setSessionUsage(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && setSelectedEventId(null)}>
      {event && unit && (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <DialogHeader
            onClose={() => setSelectedEventId(null)}
            className="px-6 py-3"
            trailing={<GeminiCostPopover usage={sessionUsage} />}
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-teal-600">{unit.focusSubTest}</Badge>
                <BookOpen className="h-4 w-4 text-teal-600" aria-hidden="true" />
                {event.status === "completed" && (
                  <Badge variant="success">Completed</Badge>
                )}
              </div>
              <DialogTitle>{unit.focusTarget}</DialogTitle>
              <p className="text-sm text-gray-500">
                {format(parseISO(event.start), "EEEE, MMM d")} ·{" "}
                {unit.sessionGoal}
              </p>
            </div>
          </DialogHeader>

          <DialogContent>
            <VocabularyModalContent
              key={event.id}
              eventId={event.id}
              sessionDate={format(parseISO(event.start), "yyyy-MM-dd")}
              onUsageChange={setSessionUsage}
            />
          </DialogContent>
        </div>
      )}
    </Dialog>
  );
}
