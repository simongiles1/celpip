"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConceptPractice } from "@/components/session/ConceptPractice";
import {
  ConceptChatButton,
  ConceptChatPanel,
} from "@/components/session/ConceptChatPanel";
import { GeminiCostPopover } from "@/components/session/GeminiCostPopover";
import { useStudyStore } from "@/hooks/useStudyStore";
import { useConceptChat } from "@/hooks/useConceptChat";
import {
  appendConceptGradeMetadata,
  parseConceptSubmission,
} from "@/lib/concept-submission";
import {
  conceptSetEventId,
  formatQuestionSetLabel,
  getConceptSetScore,
  getGeneratedSetsForConcept,
  getNextSetNumber,
  getStoredSetScore,
  legacyConceptEventId,
} from "@/lib/concept-question-sets";
import { combineGeminiUsage } from "@/lib/gemini-session-usage";
import type { GeminiCostBreakdown } from "@/lib/gemini-usage";
import { getConceptById } from "@/lib/skill-profile";
import type { GeneratedContent, GenerateResponse, GradeResponse } from "@/lib/types";

const GENERATE_FETCH_TIMEOUT_MS = 95_000;

interface ConceptSessionModalProps {
  conceptId: string | null;
  onClose: () => void;
}

function contentFromCache(cached: GeneratedContent): GenerateResponse | null {
  if (!cached.conceptDrillItems?.length) return null;
  return {
    instructions: cached.instructions,
    example: cached.example,
    examPrompt: cached.examPrompt,
    conceptDrillItems: cached.conceptDrillItems,
  };
}

function resolveSetEventId(
  conceptId: string,
  setNumber: number,
  sets: GeneratedContent[],
): string {
  const match = sets.find((item) => (item.setNumber ?? 1) === setNumber);
  if (match) return match.eventId;
  if (setNumber === 1) return legacyConceptEventId(conceptId);
  return conceptSetEventId(conceptId, setNumber);
}

export function ConceptSessionModal({ conceptId, onClose }: ConceptSessionModalProps) {
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const geminiModel = useStudyStore((s) => s.geminiModel);
  const generated = useStudyStore((s) => s.generated);
  const graded = useStudyStore((s) => s.graded);
  const addGenerated = useStudyStore((s) => s.addGenerated);
  const addGraded = useStudyStore((s) => s.addGraded);
  const getGeneratedForEvent = useStudyStore((s) => s.getGeneratedForEvent);
  const getGradedForEvent = useStudyStore((s) => s.getGradedForEvent);
  const removeGeneratedForEvent = useStudyStore((s) => s.removeGeneratedForEvent);

  const concept = conceptId ? getConceptById(skillProfile, conceptId) : undefined;

  const conceptSets = useMemo(
    () => (conceptId ? getGeneratedSetsForConcept(generated, conceptId) : []),
    [generated, conceptId],
  );

  const [activeSetNumber, setActiveSetNumber] = useState(1);
  const [content, setContent] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingNewSet, setGeneratingNewSet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drillResponses, setDrillResponses] = useState<string[]>([]);
  const [writingResponse, setWritingResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResponse | null>(null);
  const [generateUsage, setGenerateUsage] = useState<GeminiCostBreakdown | undefined>();
  const [gradeUsage, setGradeUsage] = useState<GeminiCostBreakdown | undefined>();
  const [chatUsage, setChatUsage] = useState<GeminiCostBreakdown | undefined>();
  const [sessionUsage, setSessionUsage] = useState<GeminiCostBreakdown | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const drillItems = content?.conceptDrillItems ?? [];

  const {
    chatOpen,
    setChatOpen,
    sending: chatSending,
    chatError,
    messages: chatMessages,
    sendMessage,
    conceptDocument,
    conceptDescription,
    generateOverrides,
  } = useConceptChat({
    concept,
    drillItems,
    onUsage: setChatUsage,
  });

  useEffect(() => {
    setSessionUsage(
      combineGeminiUsage(geminiModel, generateUsage, gradeUsage, chatUsage),
    );
  }, [generateUsage, gradeUsage, chatUsage, geminiModel]);

  const activeEventId = conceptId
    ? resolveSetEventId(conceptId, activeSetNumber, conceptSets)
    : "";

  const loadSetState = useCallback(
    (setNumber: number, sets: GeneratedContent[]) => {
      if (!conceptId) return;

      const eventId = resolveSetEventId(conceptId, setNumber, sets);
      const cached = getGeneratedForEvent(eventId);
      const cachedContent = cached ? contentFromCache(cached) : null;

      const existingGrade = getGradedForEvent(eventId);
      const savedSubmission =
        typeof existingGrade?.studentSubmission === "string"
          ? existingGrade.studentSubmission
          : "";
      const savedAnswers = savedSubmission
        ? parseConceptSubmission(savedSubmission)
        : null;

      setContent(cachedContent);
      setWritingResponse(savedAnswers?.writingAnswer ?? "");
      setDrillResponses(savedAnswers?.drillAnswers ?? []);
      setGradeResult(
        savedAnswers?.gradeMetadata
          ? {
              estimatedBand: savedAnswers.gradeMetadata.estimatedBand,
              overallFeedback: existingGrade?.overallFeedback ?? "",
              positives: existingGrade?.positives ?? [],
              constructiveCriticism: existingGrade?.constructiveCriticism ?? [],
              grammarCorrections: existingGrade?.grammarCorrections ?? [],
              drillResults: savedAnswers.gradeMetadata.drillResults,
              writingResult: savedAnswers.gradeMetadata.writingResult,
            }
          : null,
      );
      setGenerateUsage(cached?.geminiUsage);
      setGradeUsage(existingGrade?.geminiUsage);
    },
    [conceptId, getGeneratedForEvent, getGradedForEvent],
  );

  const generateSet = useCallback(
    async (setNumber: number, options?: { switchToSet?: boolean }) => {
      if (!conceptId || !concept) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), GENERATE_FETCH_TIMEOUT_MS);

      const eventId = conceptSetEventId(conceptId, setNumber);
      const isFirstSet = setNumber === 1;

      if (isFirstSet) {
        setLoading(true);
      } else {
        setGeneratingNewSet(true);
      }
      setError(null);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            focusSubTest: "Concept",
            focusTarget: concept.label,
            practiceType: "Concept Drill",
            sessionMode: "concept",
            targetConceptId: concept.id,
            targetConceptLabel: concept.label,
            targetConceptDescription: conceptDescription,
            conceptExercisesOnly: true,
            conceptSetNumber: setNumber,
            ...generateOverrides,
            model: geminiModel,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ?? "Failed to generate concept drill",
          );
        }

        const data = (await res.json()) as GenerateResponse;
        if (controller.signal.aborted) return;

        if (!data.conceptDrillItems?.length) {
          throw new Error("Generated drill has no exercises. Please retry.");
        }

        addGenerated({
          eventId,
          instructions: data.instructions,
          example: data.example,
          examPrompt: data.examPrompt,
          conceptDrillItems: data.conceptDrillItems,
          conceptId: concept.id,
          setNumber,
          generatedAt: new Date().toISOString(),
          geminiUsage: data.geminiUsage,
        });

        if (options?.switchToSet !== false) {
          setActiveSetNumber(setNumber);
          setContent(data);
          setDrillResponses(Array(data.conceptDrillItems.length).fill(""));
          setWritingResponse("");
          setGradeResult(null);
          setGenerateUsage(data.geminiUsage);
          setGradeUsage(undefined);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setError(
            "Generation timed out. Try Gemini 2.5 Flash in Settings, or click Retry.",
          );
        } else {
          setError(err instanceof Error ? err.message : "Generation failed");
        }
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
        setGeneratingNewSet(false);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [addGenerated, concept, conceptDescription, conceptId, geminiModel, generateOverrides],
  );

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (!conceptId || !concept) {
      setContent(null);
      setLoading(false);
      setGeneratingNewSet(false);
      setError(null);
      setDrillResponses([]);
      setWritingResponse("");
      setGradeResult(null);
      setGenerateUsage(undefined);
      setGradeUsage(undefined);
      setChatUsage(undefined);
      setActiveSetNumber(1);
      setChatOpen(false);
      return;
    }

    const sets = getGeneratedSetsForConcept(
      useStudyStore.getState().generated,
      conceptId,
    );
    if (sets.length > 0) {
      const initialSet = sets[0].setNumber ?? 1;
      setActiveSetNumber(initialSet);
      loadSetState(initialSet, sets);
      setLoading(false);
      setError(null);
      return;
    }

    setActiveSetNumber(1);
    void generateSet(1);
  }, [conceptId, concept, generateSet, loadSetState]);

  useEffect(() => {
    if (!content?.conceptDrillItems?.length) return;
    if (drillResponses.length === content.conceptDrillItems.length) return;
    setDrillResponses((prev) => {
      if (prev.length === content.conceptDrillItems!.length) return prev;
      return Array(content.conceptDrillItems!.length).fill("");
    });
  }, [content?.conceptDrillItems, drillResponses.length]);

  const handleSelectQuestionSet = (setNumber: number) => {
    if (setNumber === activeSetNumber) return;
    setActiveSetNumber(setNumber);
    loadSetState(setNumber, conceptSets);
    setError(null);
  };

  const handleNewQuestionSet = () => {
    if (!conceptId || generatingNewSet || loading) return;
    const nextSetNumber = getNextSetNumber(conceptSets);
    void generateSet(nextSetNumber);
  };

  const handleRetry = () => {
    if (!conceptId) return;
    const eventId = resolveSetEventId(conceptId, activeSetNumber, conceptSets);
    removeGeneratedForEvent(eventId);
    setError(null);
    void generateSet(activeSetNumber);
  };

  const handleSubmit = async () => {
    if (!content || !concept) return;
    setSubmitting(true);
    setError(null);

    const drillItems = content.conceptDrillItems ?? [];
    const drillBlock = drillItems
      .map((item, i) => `Q: ${item.prompt}\nA: ${drillResponses[i] ?? ""}`)
      .join("\n\n");
    const baseSubmission = `DRILL RESPONSES:\n${drillBlock}\n\nMINI WRITING:\n${writingResponse}`;

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focusSubTest: "Concept",
          examPrompt: content.examPrompt,
          studentSubmission: baseSubmission,
          conceptLabel: concept.label,
          drillResponses: drillBlock,
          model: geminiModel,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Grading failed");
      }

      const result = (await res.json()) as GradeResponse;
      const fullSubmission = appendConceptGradeMetadata(
        baseSubmission,
        result,
        drillItems.length,
      );

      setGradeResult(result);
      setGradeUsage(result.geminiUsage);
      addGraded(
        {
          eventId: activeEventId,
          curriculumUnitId: `concept-unit-${concept.id}`,
          focusSubTest: "Concept",
          estimatedBand: result.estimatedBand,
          overallFeedback: result.overallFeedback,
          positives: result.positives,
          constructiveCriticism: result.constructiveCriticism,
          grammarCorrections: result.grammarCorrections,
          studentSubmission: fullSubmission,
          gradedAt: new Date().toISOString(),
          geminiUsage: result.geminiUsage,
        },
        result,
        "concept",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed");
    } finally {
      setSubmitting(false);
    }
  };

  const questionSets = useMemo(() => {
    const sets =
      conceptSets.length > 0
        ? conceptSets
        : [{ setNumber: 1, eventId: activeEventId } as GeneratedContent];

    return sets.map((set) => {
      const setNumber = set.setNumber ?? 1;
      const eventId =
        set.eventId ??
        (conceptId ? resolveSetEventId(conceptId, setNumber, conceptSets) : "");
      const storedScore = getStoredSetScore(graded, eventId);
      const liveScore =
        setNumber === activeSetNumber
          ? getConceptSetScore(gradeResult, set.conceptDrillItems?.length ?? content?.conceptDrillItems?.length)
          : null;
      const score = storedScore ?? liveScore;

      return {
        setNumber,
        label: formatQuestionSetLabel(setNumber, score),
        isActive: setNumber === activeSetNumber,
      };
    });
  }, [
    activeEventId,
    activeSetNumber,
    conceptId,
    conceptSets,
    content?.conceptDrillItems?.length,
    gradeResult,
    graded,
  ]);

  const open = Boolean(conceptId && concept);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {concept && (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <DialogHeader
            onClose={onClose}
            className="px-6 py-3"
            trailing={
              <>
                <ConceptChatButton onClick={() => setChatOpen(true)} />
                <GeminiCostPopover usage={sessionUsage} />
              </>
            }
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Concept Drill</Badge>
                <Badge variant="outline">{concept.category}</Badge>
              </div>
              <DialogTitle>{concept.label}</DialogTitle>
            </div>
          </DialogHeader>
          <DialogContent>
            {loading ? (
              <div className="space-y-3 py-4">
                <p className="text-sm text-gray-600">
                  Generating question set 1… This usually takes 20–40 seconds.
                </p>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : error && !content ? (
              <div className="space-y-4 py-4 text-center">
                <p className="text-red-600">{error}</p>
                <Button type="button" variant="outline" onClick={handleRetry}>
                  Retry
                </Button>
              </div>
            ) : content ? (
              <ConceptPractice
                document={conceptDocument}
                questionSets={questionSets}
                onSelectQuestionSet={handleSelectQuestionSet}
                onNewQuestionSet={handleNewQuestionSet}
                generatingNewSet={generatingNewSet}
                examPrompt={content.examPrompt}
                drillItems={drillItems}
                drillResponses={drillResponses}
                onDrillChange={(index, value) => {
                  setDrillResponses((prev) => {
                    const next = [...prev];
                    next[index] = value;
                    return next;
                  });
                }}
                writingResponse={writingResponse}
                onWritingChange={setWritingResponse}
                onSubmit={handleSubmit}
                submitting={submitting}
                gradeResult={gradeResult}
              />
            ) : null}
            {error && content && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
            {chatError && (
              <p className="mt-3 text-sm text-red-600">{chatError}</p>
            )}
          </DialogContent>

          <ConceptChatPanel
            open={chatOpen}
            onOpenChange={setChatOpen}
            conceptLabel={concept.label}
            messages={chatMessages}
            onSend={sendMessage}
            sending={chatSending}
          />
        </div>
      )}
    </Dialog>
  );
}
