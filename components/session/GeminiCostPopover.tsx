"use client";

import { useEffect, useRef, useState } from "react";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatTokenCount,
  formatUsd,
  type GeminiCostBreakdown,
} from "@/lib/gemini-usage";
import { cn } from "@/lib/utils";

interface GeminiCostPopoverProps {
  usage: GeminiCostBreakdown | null;
  className?: string;
}

export function GeminiCostPopover({ usage, className }: GeminiCostPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="View API usage and cost"
        aria-expanded={open}
        className="text-gray-600"
      >
        <DollarSign className="h-4 w-4" />
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Gemini API cost"
          className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg"
        >
          {usage && usage.totalTokens > 0 ? (
            <dl className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">Input</dt>
                <dd className="text-right font-medium text-gray-900">
                  {formatTokenCount(usage.inputTokens)} tokens
                  <span className="block text-xs font-normal text-gray-500">
                    {formatUsd(usage.inputCostUsd)}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">Output</dt>
                <dd className="text-right font-medium text-gray-900">
                  {formatTokenCount(usage.outputTokens)} tokens
                  <span className="block text-xs font-normal text-gray-500">
                    {formatUsd(usage.outputCostUsd)}
                  </span>
                </dd>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <div className="flex items-center justify-between gap-4">
                  <dt className="font-medium text-gray-900">Total</dt>
                  <dd className="text-right font-semibold text-gray-900">
                    {formatTokenCount(usage.totalTokens)} tokens
                    <span className="block text-xs font-semibold text-blue-700">
                      {formatUsd(usage.totalCostUsd)}
                    </span>
                  </dd>
                </div>
              </div>
              <p className="text-xs text-gray-400">{usage.model}</p>
            </dl>
          ) : (
            <p className="text-gray-500">No API usage recorded yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
