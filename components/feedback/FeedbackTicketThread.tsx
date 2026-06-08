"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { FeedbackTicketMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FeedbackTicketThreadProps {
  ticketId: string;
  description: string;
  createdAt: string;
  messages: FeedbackTicketMessage[];
  onMessageSent: (message: FeedbackTicketMessage) => void;
  className?: string;
}

export function FeedbackTicketThread({
  ticketId,
  description,
  createdAt,
  messages,
  onMessageSent,
  className,
}: FeedbackTicketThreadProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const handleSubmit = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setSendError(null);

    try {
      const response = await fetch(`/api/feedback/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      const data = (await response.json()) as {
        message?: FeedbackTicketMessage;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to send message");
      }

      if (data.message) {
        onMessageSent(data.message);
      }
      setDraft("");
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Failed to send message",
      );
    } finally {
      setSending(false);
    }
  }, [draft, onMessageSent, sending, ticketId]);

  return (
    <div
      className={cn(
        "flex min-h-[18rem] flex-col rounded-lg border border-gray-200 bg-gray-50/50",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-2">
        <MessageCircle className="h-4 w-4 text-gray-500" />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Thread
        </span>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-1 max-h-72 lg:max-h-none"
      >
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Original report · {format(new Date(createdAt), "MMM d, h:mm a")}
          </p>
          <p className="whitespace-pre-wrap text-sm text-gray-800">
            {description}
          </p>
        </div>

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              "border border-gray-200 bg-white text-gray-800",
            )}
          >
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
              {format(new Date(message.createdAt), "MMM d, h:mm a")}
            </p>
            <p className="whitespace-pre-wrap">{message.body}</p>
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending…
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200 p-3">
        {sendError && (
          <p className="mb-2 text-sm text-red-700">{sendError}</p>
        )}
        <div className="flex gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Write a reply…"
            rows={2}
            className="min-h-[4.5rem] flex-1 resize-none bg-white"
            disabled={sending}
          />
          <Button
            type="button"
            size="icon"
            onClick={() => void handleSubmit()}
            disabled={sending || !draft.trim()}
            aria-label="Send reply"
            className="shrink-0 self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
