"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { BookOpen, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GeminiCostPopover } from "@/components/session/GeminiCostPopover";
import { Skeleton } from "@/components/ui/skeleton";
import { useSelectedEvent, useStudyStore } from "@/hooks/useStudyStore";
import type { GeminiCostBreakdown } from "@/lib/gemini-usage";
import type { VocabularyWord } from "@/lib/types";

function VocabularyCard({
  word,
  revealed,
  onReveal,
}: {
  word: VocabularyWord;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-2xl font-semibold text-gray-900">{word.word}</h3>
          <p className="mt-1 text-sm text-gray-500">{word.partOfSpeech}</p>
        </div>
        {!revealed && (
          <Button type="button" size="sm" variant="outline" onClick={onReveal}>
            <Eye className="mr-1.5 h-4 w-4" />
            Reveal
          </Button>
        )}
      </div>

      {revealed ? (
        <div className="space-y-3 text-sm">
          <p className="text-gray-800">{word.definition}</p>
          {word.spokenAlternative && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              <span className="font-medium">Instead of saying </span>
              &ldquo;{word.spokenAlternative}&rdquo;
              <span className="font-medium"> in writing, use </span>
              &ldquo;{word.word}&rdquo;.
            </p>
          )}
          <blockquote className="border-l-4 border-teal-500 pl-3 italic text-gray-700">
            {word.exampleSentence}
          </blockquote>
          <p className="text-gray-600">
            <span className="font-medium text-gray-800">Writing tip: </span>
            {word.writingTip}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Try to recall the meaning, then reveal the definition and example.
        </p>
      )}
    </div>
  );
}

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
  const markEventCompleted = useStudyStore((s) => s.markEventCompleted);
  const removeGeneratedForEvent = useStudyStore(
    (s) => s.removeGeneratedForEvent,
  );

  const cached = getGeneratedForEvent(eventId);
  const [words, setWords] = useState<VocabularyWord[]>(
    cached?.vocabularyWords ?? [],
  );
  const [loading, setLoading] = useState(!cached?.vocabularyWords?.length);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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
        setCurrentIndex(0);
        setRevealed(false);
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
    } else {
      onUsageChange(cached.geminiUsage ?? null);
    }
  }, [cached, fetchWords, onUsageChange]);

  const currentWord = words[currentIndex];
  const isLastWord = currentIndex >= words.length - 1;
  const allRevealed = revealed || words.length === 0;

  const handleNext = () => {
    if (isLastWord) return;
    setCurrentIndex((i) => i + 1);
    setRevealed(false);
  };

  const handlePrevious = () => {
    if (currentIndex <= 0) return;
    setCurrentIndex((i) => i - 1);
    setRevealed(true);
  };

  const handleComplete = () => {
    markEventCompleted(eventId);
  };

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <p className="text-sm text-gray-600">
        {words.length} words for today — formal vocabulary to strengthen your
        CELPIP writing. Reveal each word, read the example, then move on.
      </p>

      {currentWord && (
        <VocabularyCard
          word={currentWord}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          Word {currentIndex + 1} of {words.length}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          {!isLastWord ? (
            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              disabled={!allRevealed}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleComplete}
              disabled={!revealed}
            >
              Complete session
            </Button>
          )}
        </div>
      </div>

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
