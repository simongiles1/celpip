"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import type { ConceptChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ConceptCreateChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ConceptChatMessage[];
  onSend: (message: string) => Promise<void>;
  sending: boolean;
  onReset?: () => void;
}

export function ConceptCreateChatPanel({
  open,
  onOpenChange,
  messages,
  onSend,
  sending,
  onReset,
}: ConceptCreateChatPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setDraft("");
    }
  }, [open]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending, open]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    onReset?.();
  }, [onOpenChange, onReset]);

  const handleSubmit = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    await onSend(text);
  }, [draft, onSend, sending]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
      panelClassName="max-w-lg"
      size="auto"
      slideFromBottom
    >
      <DialogHeader onClose={handleClose}>
        <DialogTitle>Add a concept</DialogTitle>
        <p className="mt-1 text-sm text-gray-500">
          Describe a micro-skill you want to practice. The assistant will ask
          clarifying questions, then add it to your Concept Lab.
        </p>
      </DialogHeader>

      <DialogContent className="gap-0 p-0">
        <div
          ref={scrollRef}
          className="max-h-[min(24rem,50vh)] space-y-3 overflow-y-auto px-6 py-4"
        >
          {messages.length === 0 && (
            <p className="text-sm text-gray-500">
              Example: &ldquo;I keep mixing up &lsquo;fewer&rsquo; and
              &lsquo;less&rsquo; in formal writing.&rdquo; or &ldquo;I want
              drills on finding the main idea in Part 3 matching
              passages.&rdquo;
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
                <p className="mt-2 border-t border-green-200 pt-2 text-xs text-green-700">
                  {message.changesSummary}
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

        <div className="shrink-0 border-t border-gray-200 p-4">
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
              placeholder="Describe the concept you want…"
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
      </DialogContent>
    </Dialog>
  );
}
