"use client";

import { useEffect, useState } from "react";
import {
  formatExamCountdown,
  formatStudyBlockCountdown,
} from "@/lib/exam-timing";
import { cn } from "@/lib/utils";

interface UseExamCountdownOptions {
  /** When true, the timer keeps ticking after zero and remaining goes negative. */
  countOvertime?: boolean;
  /**
   * Forces a fresh countdown when this value changes (e.g. mock segment index).
   * Needed when multiple segments share the same `totalSeconds`.
   */
  resetKey?: string | number;
}

interface UseExamCountdownResult {
  remaining: number;
  expired: boolean;
}

export function useExamCountdown(
  totalSeconds: number,
  started: boolean,
  options?: UseExamCountdownOptions,
): UseExamCountdownResult {
  const countOvertime = options?.countOvertime ?? false;
  const resetKey = options?.resetKey;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setRemaining(totalSeconds);
    setExpired(false);
  }, [totalSeconds, resetKey]);

  useEffect(() => {
    if (!started) return;

    const intervalId = window.setInterval(() => {
      setRemaining((current) => {
        if (!countOvertime) {
          if (current <= 1) {
            setExpired(true);
            return 0;
          }
          return current - 1;
        }

        const next = current - 1;
        if (next <= 0) {
          setExpired(true);
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [started, countOvertime]);

  return { remaining, expired };
}

interface ExamCountdownProps {
  remaining: number;
  expired: boolean;
  className?: string;
  label?: string;
  countOvertime?: boolean;
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
  countOvertime = false,
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
        {countOvertime
          ? formatStudyBlockCountdown(remaining, expired)
          : expired
            ? "Time's up"
            : formatExamCountdown(remaining)}
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
  countOvertime?: boolean;
}

function DualCountdownChip({
  label,
  remaining,
  expired,
  compact,
  countOvertime = false,
}: {
  label: string;
  remaining: number;
  expired: boolean;
  compact?: boolean;
  countOvertime?: boolean;
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
        {countOvertime
          ? formatStudyBlockCountdown(remaining, expired)
          : expired
            ? "Time's up"
            : formatExamCountdown(remaining)}
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
  countOvertime = false,
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
        countOvertime={countOvertime}
      />
      {showPassage && (
        <DualCountdownChip
          label="Suggested pace"
          remaining={passageRemaining}
          expired={passageExpired}
          compact={inline}
          countOvertime={countOvertime}
        />
      )}
    </div>
  );
}
