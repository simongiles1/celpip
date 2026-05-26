"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { ConceptChatMessage } from "@/lib/types";
import type { GeminiCostBreakdown } from "@/lib/gemini-usage";
import { cn } from "@/lib/utils";

interface ConceptChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conceptLabel: string;
  messages: ConceptChatMessage[];
  onSend: (message: string) => Promise<void>;
  sending: boolean;
  onUsage?: (usage: GeminiCostBreakdown) => void;
  className?: string;
}

export function ConceptChatButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label="Open concept tutor chat"
      className={cn("text-gray-600", className)}
    >
      <MessageCircle className="h-4 w-4" />
    </Button>
  );
}

export function ConceptChatPanel({
  open,
  onOpenChange,
  conceptLabel,
  messages,
  onSend,
  sending,
  className,
}: ConceptChatPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending, open]);

  const handleSubmit = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    await onSend(text);
  }, [draft, onSend, sending]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute inset-y-0 right-0 z-10 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="min-w-0 pr-2">
          <p className="text-sm font-semibold text-gray-900">Concept tutor</p>
          <p className="truncate text-xs text-gray-500">{conceptLabel}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <p className="shrink-0 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-600">
        Ask about the instructions or exercises. The tutor can update both.
      </p>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">
            Example: &ldquo;The instructions miss &lsquo;listened to&rsquo; — movement
            toward sound, not just places.&rdquo; or &ldquo;Drop fix-the-sentence
            questions; use fill-in-the-blank only.&rdquo;
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.timestamp}-${index}`}
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              message.role === "user"
                ? "ml-6 bg-blue-600 text-white"
                : "mr-6 border border-gray-200 bg-gray-50 text-gray-800",
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            {message.changesSummary && (
              <p
                className={cn(
                  "mt-2 border-t pt-2 text-xs",
                  message.role === "user"
                    ? "border-blue-400 text-blue-100"
                    : "border-gray-200 text-green-700",
                )}
              >
                Updated: {message.changesSummary}
              </p>
            )}
          </div>
        ))}
        {sending && (
          <div className="mr-6 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200 p-3">
        <div className="flex gap-2">
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
            placeholder="Ask or give feedback…"
            rows={2}
            className="min-h-[4.5rem] flex-1 resize-none"
            disabled={sending}
          />
          <Button
            type="button"
            size="icon"
            onClick={() => void handleSubmit()}
            disabled={sending || !draft.trim()}
            aria-label="Send message"
            className="shrink-0 self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
