"use client";

import { useCallback, useMemo, useState } from "react";
import {
  getConceptChatMessages,
  getConceptCustomization,
  resolveConceptDescription,
  resolveConceptDocument,
  resolveDrillConstraints,
  resolveGradingFeedbackConstraints,
} from "@/lib/concept-customizations";
import type { GeminiCostBreakdown } from "@/lib/gemini-usage";
import type {
  ConceptChatContext,
  ConceptChatMessage,
  ConceptDefinition,
  ConceptDrillItem,
  GradeResponse,
} from "@/lib/types";
import { useStudyStore } from "@/hooks/useStudyStore";

interface UseConceptChatOptions {
  concept: ConceptDefinition | undefined;
  chatContext: ConceptChatContext;
  drillItems?: ConceptDrillItem[];
  gradeResult?: GradeResponse | null;
  onUsage?: (usage: GeminiCostBreakdown) => void;
}

export function useConceptChat({
  concept,
  chatContext,
  drillItems = [],
  gradeResult = null,
  onUsage,
}: UseConceptChatOptions) {
  const geminiModel = useStudyStore((s) => s.geminiModel);
  const conceptCustomizations = useStudyStore((s) => s.conceptCustomizations);
  const applyConceptChatUpdates = useStudyStore((s) => s.applyConceptChatUpdates);

  const [chatOpen, setChatOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const customization = concept
    ? getConceptCustomization(conceptCustomizations, concept.id)
    : undefined;

  const conceptDocument = useMemo(
    () => (concept ? resolveConceptDocument(concept, customization) : ""),
    [concept, customization],
  );

  const conceptDescription = useMemo(
    () => (concept ? resolveConceptDescription(concept, customization) : ""),
    [concept, customization],
  );

  const drillConstraints = useMemo(
    () => resolveDrillConstraints(concept?.id, customization),
    [concept?.id, customization],
  );

  const gradingFeedbackConstraints = useMemo(
    () => resolveGradingFeedbackConstraints(customization),
    [customization],
  );

  const messages = useMemo(
    () => getConceptChatMessages(customization, chatContext),
    [customization, chatContext],
  );

  const recentGradingFeedback = useMemo(() => {
    if (!gradeResult?.drillResults?.length) return "";
    return gradeResult.drillResults
      .map(
        (result) =>
          `Q${result.index + 1} (${result.isCorrect ? "correct" : "incorrect"}): ${result.feedback}`,
      )
      .join("\n");
  }, [gradeResult?.drillResults]);

  const generateOverrides = useMemo(
    () => ({
      conceptDescriptionOverride: customization?.descriptionOverride,
      conceptDrillConstraintsOverride: customization?.drillConstraints,
      conceptGradingFeedbackConstraintsOverride:
        customization?.gradingFeedbackConstraints,
    }),
    [customization],
  );

  const sendMessage = useCallback(
    async (message: string) => {
      if (!concept) return;

      setSending(true);
      setChatError(null);

      const timestamp = new Date().toISOString();
      const userMessage: ConceptChatMessage = {
        role: "user",
        content: message,
        timestamp,
      };

      try {
        const res = await fetch("/api/concept-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatContext,
            conceptId: concept.id,
            conceptLabel: concept.label,
            conceptDescription,
            instructionDocument: conceptDocument,
            drillConstraints,
            gradingFeedbackConstraints,
            currentQuestions: drillItems.map((item) => item.prompt),
            recentGradingFeedback,
            message,
            chatHistory: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            model: geminiModel,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ?? "Chat request failed",
          );
        }

        const data = (await res.json()) as {
          reply: string;
          changesSummary?: string | null;
          updates?: {
            instructionMarkdown?: string;
            drillConstraints?: string;
            gradingFeedbackConstraints?: string;
            descriptionOverride?: string;
          };
          geminiUsage?: GeminiCostBreakdown;
        };

        if (data.geminiUsage) {
          onUsage?.(data.geminiUsage);
        }

        const assistantMessage: ConceptChatMessage = {
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
          changesSummary: data.changesSummary ?? undefined,
        };

        applyConceptChatUpdates(
          concept.id,
          chatContext,
          userMessage,
          assistantMessage,
          data.updates,
        );
      } catch (err) {
        setChatError(err instanceof Error ? err.message : "Chat failed");
      } finally {
        setSending(false);
      }
    },
    [
      applyConceptChatUpdates,
      chatContext,
      concept,
      conceptDescription,
      conceptDocument,
      drillConstraints,
      drillItems,
      geminiModel,
      gradingFeedbackConstraints,
      messages,
      onUsage,
      recentGradingFeedback,
    ],
  );

  return {
    chatOpen,
    setChatOpen,
    sending,
    chatError,
    messages,
    sendMessage,
    conceptDocument,
    conceptDescription,
    drillConstraints,
    gradingFeedbackConstraints,
    generateOverrides,
  };
}
