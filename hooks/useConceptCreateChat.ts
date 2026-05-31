"use client";

import { useCallback, useState } from "react";
import { getAllConcepts } from "@/lib/skill-profile";
import type { GeminiCostBreakdown } from "@/lib/gemini-usage";
import type { ConceptCategory, ConceptChatMessage } from "@/lib/types";
import { useStudyStore } from "@/hooks/useStudyStore";

interface UseConceptCreateChatOptions {
  onConceptCreated?: (conceptId: string, label: string) => void;
  onUsage?: (usage: GeminiCostBreakdown) => void;
}

export function useConceptCreateChat({
  onConceptCreated,
  onUsage,
}: UseConceptCreateChatOptions = {}) {
  const geminiModel = useStudyStore((s) => s.geminiModel);
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const addDiscoveredConceptToStore = useStudyStore(
    (s) => s.addDiscoveredConcept,
  );

  const [chatOpen, setChatOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConceptChatMessage[]>([]);

  const resetChat = useCallback(() => {
    setMessages([]);
    setChatError(null);
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      setSending(true);
      setChatError(null);

      const timestamp = new Date().toISOString();
      const userMessage: ConceptChatMessage = {
        role: "user",
        content: message,
        timestamp,
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const existingConcepts = getAllConcepts(skillProfile).map((c) => ({
          label: c.label,
          category: c.category,
          description: c.description,
        }));

        const res = await fetch("/api/concept-create-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            chatHistory: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            existingConcepts,
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
          readyToCreate: boolean;
          concept?: {
            label: string;
            category: ConceptCategory;
            description: string;
            examples?: string[];
            aliases?: string[];
            id?: string;
          };
          geminiUsage?: GeminiCostBreakdown;
        };

        if (data.geminiUsage) {
          onUsage?.(data.geminiUsage);
        }

        let replyContent = data.reply;
        let changesSummary: string | undefined;

        if (data.readyToCreate && data.concept) {
          const result = addDiscoveredConceptToStore({
            id: data.concept.id ?? "",
            label: data.concept.label,
            category: data.concept.category,
            description: data.concept.description,
            examples: data.concept.examples,
            aliases: data.concept.aliases,
          });

          if (result.error) {
            replyContent = `${data.reply}\n\nCould not save: ${result.error}`;
          } else if (result.conceptId) {
            changesSummary = `Added "${data.concept.label}" to Concept Lab`;
            onConceptCreated?.(result.conceptId, data.concept.label);
          }
        }

        const assistantMessage: ConceptChatMessage = {
          role: "assistant",
          content: replyContent,
          timestamp: new Date().toISOString(),
          changesSummary,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        setChatError(err instanceof Error ? err.message : "Chat failed");
      } finally {
        setSending(false);
      }
    },
    [
      addDiscoveredConceptToStore,
      geminiModel,
      messages,
      onConceptCreated,
      onUsage,
      skillProfile,
    ],
  );

  return {
    chatOpen,
    setChatOpen,
    sending,
    chatError,
    messages,
    sendMessage,
    resetChat,
  };
}
