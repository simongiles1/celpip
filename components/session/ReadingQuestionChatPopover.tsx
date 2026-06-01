"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { MarkdownContent } from "@/components/ui/markdown";
import { useStudyStore } from "@/hooks/useStudyStore";
import type { GeminiCostBreakdown } from "@/lib/gemini-usage";
import {
  EMPTY_READING_QUESTION_CHAT_MESSAGES,
  getReadingQuestionChatMessages,
} from "@/lib/reading-submission";
import type {
  ConceptChatMessage,
  GradedSession,
  ReadingQuestion,
  ReadingQuestionResult,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReadingQuestionChatPopoverProps {
  passageEventId: string;
  examPrompt: string;
  question: ReadingQuestion;
  questionIndex: number;
  studentAnswerIndex: number;
  result: ReadingQuestionResult;
  onUsage?: (usage: GeminiCostBreakdown) => void;
  className?: string;
}

const PANEL_WIDTH = 320;
const PANEL_MAX_HEIGHT = 360;

function computePanelPosition(anchor: DOMRect): { top: number; left: number } {
  const margin = 8;
  let left = anchor.right - PANEL_WIDTH;
  left = Math.max(margin, Math.min(left, window.innerWidth - PANEL_WIDTH - margin));

  let top = anchor.bottom + margin;
  const estimatedHeight = PANEL_MAX_HEIGHT + 48;
  if (top + estimatedHeight > window.innerHeight - margin) {
    top = Math.max(margin, anchor.top - estimatedHeight - margin);
  }

  return { top, left };
}

export function ReadingQuestionChatPopover({
  passageEventId,
  examPrompt,
  question,
  questionIndex,
  studentAnswerIndex,
  result,
  onUsage,
  className,
}: ReadingQuestionChatPopoverProps) {
  const geminiModel = useStudyStore((s) => s.geminiModel);
  const selectMessages = useMemo(
    () => (state: { graded: GradedSession[] }) => {
      const session = state.graded.find((g) => g.eventId === passageEventId);
      if (!session) return EMPTY_READING_QUESTION_CHAT_MESSAGES;
      return getReadingQuestionChatMessages(session.studentSubmission, questionIndex);
    },
    [passageEventId, questionIndex],
  );
  const messages = useStudyStore(selectMessages);
  const setReadingQuestionChatMessages = useStudyStore(
    (s) => s.setReadingQuestionChatMessages,
  );
  const panelId = `reading-chat-panel-${passageEventId}-${questionIndex}`;
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const update = () => {
      if (buttonRef.current) {
        setPanelPos(computePanelPosition(buttonRef.current.getBoundingClientRect()));
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending, open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      const panel = document.getElementById(panelId);
      if (panel?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, panelId]);

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
      const priorMessages = messages;
      setReadingQuestionChatMessages(passageEventId, questionIndex, [
        ...priorMessages,
        userMessage,
      ]);

      try {
        const res = await fetch("/api/reading-question-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examPrompt,
            question: question.question,
            options: question.options,
            correctAnswerIndex: question.correctAnswerIndex,
            studentAnswerIndex,
            gradingFeedback: result.feedback,
            celpipPart: result.celpipPart ?? question.celpipPart,
            questionType: result.questionType ?? question.questionType,
            message,
            chatHistory: priorMessages.map((m) => ({
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
          geminiUsage?: GeminiCostBreakdown;
        };

        if (data.geminiUsage) {
          onUsage?.(data.geminiUsage);
        }

        const assistantMessage: ConceptChatMessage = {
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
        };
        setReadingQuestionChatMessages(passageEventId, questionIndex, [
          ...priorMessages,
          userMessage,
          assistantMessage,
        ]);
      } catch (err) {
        setChatError(err instanceof Error ? err.message : "Chat failed");
        setReadingQuestionChatMessages(
          passageEventId,
          questionIndex,
          priorMessages,
        );
      } finally {
        setSending(false);
      }
    },
    [
      examPrompt,
      geminiModel,
      messages,
      onUsage,
      passageEventId,
      question,
      questionIndex,
      result,
      setReadingQuestionChatMessages,
      studentAnswerIndex,
    ],
  );

  const handleSubmit = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    await sendMessage(text);
  }, [draft, sendMessage, sending]);

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            id={panelId}
            role="dialog"
            aria-label={`Ask about question ${questionIndex + 1}`}
            className="fixed z-[100] flex flex-col rounded-lg border border-gray-200 bg-white shadow-xl"
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: PANEL_WIDTH,
              maxHeight: PANEL_MAX_HEIGHT,
            }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-3 py-2">
              <p className="text-xs font-semibold text-gray-900">
                Ask about this question
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div
              ref={scrollRef}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2"
            >
              {messages.length === 0 && (
                <p className="text-xs text-gray-500">
                  Example: &ldquo;Why isn&apos;t option B supported by the
                  passage?&rdquo; or &ldquo;What phrase proves the correct
                  answer?&rdquo;
                </p>
              )}
              {messages.map((message, index) => (
                <div
                  key={`${message.timestamp}-${index}`}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs",
                    message.role === "user"
                      ? "ml-4 bg-blue-600 text-white"
                      : "mr-4 border border-gray-200 bg-gray-50 text-gray-800",
                  )}
                >
                  {message.role === "user" ? (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <MarkdownContent className="prose prose-sm max-w-none text-xs [&_p]:my-1 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
                      {message.content}
                    </MarkdownContent>
                  )}
                </div>
              ))}
              {sending && (
                <div className="mr-4 flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              )}
              {chatError && (
                <p className="text-xs text-red-600">{chatError}</p>
              )}
            </div>

            <div className="shrink-0 border-t border-gray-200 p-2">
              <div className="flex gap-1.5">
                <Textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder="Your question…"
                  rows={2}
                  className="min-h-[3.25rem] flex-1 resize-none text-xs"
                  disabled={sending}
                />
                <Button
                  type="button"
                  size="icon"
                  className="h-8 w-8 shrink-0 self-end"
                  onClick={() => void handleSubmit()}
                  disabled={sending || !draft.trim()}
                  aria-label="Send message"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="Ask about this question"
        aria-expanded={open}
        className={cn("h-7 w-7 shrink-0 text-blue-600", className)}
      >
        <MessageCircle className="h-4 w-4" />
      </Button>
      {panel}
    </>
  );
}
