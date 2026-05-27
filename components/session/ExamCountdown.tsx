"use client";

import { useEffect, useState } from "react";
import { formatExamCountdown } from "@/lib/exam-timing";
import { cn } from "@/lib/utils";

interface UseExamCountdownResult {
  remaining: number;
  expired: boolean;
}

export function useExamCountdown(
  totalSeconds: number,
  started: boolean,
): UseExamCountdownResult {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setRemaining(totalSeconds);
    setExpired(false);
  }, [totalSeconds]);

  useEffect(() => {
    if (!started || expired) return;

    const intervalId = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          setExpired(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [started, expired]);

  return { remaining, expired };
}

interface ExamCountdownProps {
  remaining: number;
  expired: boolean;
  className?: string;
  label?: string;
}

function countdownStyles(remaining: number, expired: boolean) {
  const isLow = remaining <= 60 && !expired;
  const isCritical = remaining <= 30 && !expired;
  return {
    container: expired
      ? "border-red-300 bg-red-50"
      : isCritical
        ? "border-red-200 bg-red-50/80"
        : isLow
          ? "border-amber-200 bg-amber-50"
          : "border-gray-200 bg-gray-50",
    time: expired
      ? "text-red-700"
      : isCritical
        ? "text-red-600"
        : isLow
          ? "text-amber-700"
          : "text-gray-900",
  };
}

export function ExamCountdownDisplay({
  remaining,
  expired,
  className,
  label = "Time remaining",
}: ExamCountdownProps) {
  const styles = countdownStyles(remaining, expired);

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-4 py-2",
        styles.container,
        className,
      )}
    >
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <span
        className={cn(
          "font-mono text-lg font-semibold tabular-nums",
          styles.time,
        )}
      >
        {expired ? "Time's up" : formatExamCountdown(remaining)}
      </span>
    </div>
  );
}

interface ExamCountdownDualProps {
  sessionRemaining: number;
  sessionExpired: boolean;
  passageRemaining: number;
  passageExpired: boolean;
  showPassage?: boolean;
  className?: string;
  /** stacked = two rows on narrow screens; inline = compact chips for a shared toolbar row */
  layout?: "stacked" | "inline";
}

function DualCountdownChip({
  label,
  remaining,
  expired,
  compact,
}: {
  label: string;
  remaining: number;
  expired: boolean;
  compact?: boolean;
}) {
  const styles = countdownStyles(remaining, expired);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border",
        compact ? "px-2.5 py-1" : "justify-between px-4 py-2",
        styles.container,
      )}
    >
      <span
        className={cn(
          "font-medium text-gray-700",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-mono font-semibold tabular-nums",
          compact ? "text-sm" : "text-lg",
          styles.time,
        )}
      >
        {expired ? "Time's up" : formatExamCountdown(remaining)}
      </span>
    </div>
  );
}

export function ExamCountdownDualDisplay({
  sessionRemaining,
  sessionExpired,
  passageRemaining,
  passageExpired,
  showPassage = true,
  className,
  layout = "stacked",
}: ExamCountdownDualProps) {
  const inline = layout === "inline";

  return (
    <div
      className={cn(
        inline ? "flex flex-wrap items-center gap-2" : "grid gap-2 sm:grid-cols-2",
        className,
      )}
    >
      <DualCountdownChip
        label="Session"
        remaining={sessionRemaining}
        expired={sessionExpired}
        compact={inline}
      />
      {showPassage && (
        <DualCountdownChip
          label="Suggested pace"
          remaining={passageRemaining}
          expired={passageExpired}
          compact={inline}
        />
      )}
    </div>
  );
}
