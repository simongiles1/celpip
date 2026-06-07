"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudyStore } from "@/hooks/useStudyStore";
import {
  prepareFocusedWritingReview,
  type FocusAnnotation,
} from "@/lib/focus-annotations";
import { getConceptById } from "@/lib/skill-profile";
import type {
  FocusHighlight,
  GrammarCorrection,
  SkillTag,
  UserSkillProfile,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface FocusedWritingReviewProps {
  studentResponse: string;
  corrections: GrammarCorrection[];
  focusHighlights: FocusHighlight[];
  focusConceptIds: string[];
  skillTags?: SkillTag[];
  onPracticeConcept?: (conceptId: string) => void;
}

interface TooltipState {
  annotation: FocusAnnotation;
  rect: DOMRect;
  placement: "above" | "below";
}

const TOOLTIP_WIDTH = 288;
const TOOLTIP_GAP = 8;
const TOOLTIP_HIDE_DELAY_MS = 500;

function segmentClassName(kind: FocusAnnotation["kind"], active: boolean): string {
  const base = (() => {
    switch (kind) {
      case "focus-correct":
        return "rounded-sm border-b-2 border-emerald-600 bg-emerald-100/90 px-0.5 text-emerald-950";
      case "focus-mistake":
        return "rounded-sm border-b-2 border-blue-600 bg-blue-100/80 px-0.5 text-blue-950 underline decoration-blue-600 decoration-wavy underline-offset-2";
      case "other-mistake":
        return "rounded-sm border-b-2 border-amber-500 bg-amber-100/90 px-0.5 text-amber-950";
      default:
        return "";
    }
  })();
  const ring =
    kind === "focus-correct"
      ? "ring-emerald-400"
      : kind === "focus-mistake"
        ? "ring-blue-400"
        : "ring-amber-400";
  return cn("cursor-help", base, active && `ring-2 ${ring} ring-offset-1`);
}

function computePlacement(
  anchorRect: DOMRect,
  tooltipHeight: number,
): "above" | "below" {
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const spaceAbove = anchorRect.top;
  if (spaceBelow >= tooltipHeight + TOOLTIP_GAP) return "below";
  if (spaceAbove >= tooltipHeight + TOOLTIP_GAP) return "above";
  return spaceBelow >= spaceAbove ? "below" : "above";
}

function FloatingFocusTooltip({
  state,
  tooltipRef,
  profile,
  onPracticeConcept,
  onMouseEnterTooltip,
  onMouseLeaveTooltip,
}: {
  state: TooltipState;
  tooltipRef: RefObject<HTMLDivElement | null>;
  profile: UserSkillProfile;
  onPracticeConcept?: (conceptId: string) => void;
  onMouseEnterTooltip: () => void;
  onMouseLeaveTooltip: () => void;
}) {
  const { annotation, rect, placement } = state;
  const conceptId = annotation.conceptId;
  const concept = conceptId ? getConceptById(profile, conceptId) : undefined;
  const conceptLabel = concept?.label ?? annotation.conceptLabel;
  const isCorrect = annotation.kind === "focus-correct";
  const correction = annotation.correction;

  const left = Math.min(
    Math.max(rect.left, TOOLTIP_GAP),
    window.innerWidth - TOOLTIP_WIDTH - TOOLTIP_GAP,
  );
  const style =
    placement === "below"
      ? { top: rect.bottom + TOOLTIP_GAP, left }
      : { bottom: window.innerHeight - rect.top + TOOLTIP_GAP, left };

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      className="fixed z-[9999] w-72 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg"
      style={style}
      onMouseEnter={onMouseEnterTooltip}
      onMouseLeave={onMouseLeaveTooltip}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {isCorrect ? "Correct usage" : "Suggested fix"}
      </p>

      {!isCorrect && correction?.corrected ? (
        <p className="mt-1 text-sm text-gray-900">
          <span className="text-red-600 line-through">
            {correction.original || annotation.text}
          </span>
          {" → "}
          <span className="font-medium text-green-700">
            {correction.corrected}
          </span>
        </p>
      ) : (
        <p className="mt-1 text-sm font-medium text-gray-900">
          {annotation.text}
        </p>
      )}

      <p className="mt-2 text-sm text-gray-600">
        {correction?.reason ?? annotation.note ?? "Review this usage."}
      </p>

      {conceptId && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <span className="text-xs font-medium text-gray-500">Concept</span>
          <Badge variant="outline" className="text-purple-800">
            {conceptLabel ?? conceptId.replace(/_/g, " ")}
          </Badge>
          {concept && onPracticeConcept && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={(event) => {
                event.stopPropagation();
                onPracticeConcept(conceptId);
              }}
            >
              Practice concept
            </Button>
          )}
          {concept && !onPracticeConcept && (
            <Link
              href={`/concepts?practice=${encodeURIComponent(conceptId)}`}
              className="text-xs text-blue-600 hover:underline"
            >
              Open in Concept Lab
            </Link>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

function AnnotationSpan({
  text,
  annotation,
  active,
  onActivate,
  onShowTooltip,
  onHideTooltip,
}: {
  text: string;
  annotation: FocusAnnotation;
  active: boolean;
  onActivate: () => void;
  onShowTooltip: (element: HTMLElement, annotation: FocusAnnotation) => void;
  onHideTooltip: () => void;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);

  const handleShow = () => {
    if (spanRef.current) {
      onShowTooltip(spanRef.current, annotation);
    }
  };

  return (
    <span
      ref={spanRef}
      className={segmentClassName(annotation.kind, active)}
      tabIndex={0}
      onMouseEnter={handleShow}
      onMouseLeave={onHideTooltip}
      onFocus={handleShow}
      onBlur={onHideTooltip}
      onClick={(event) => {
        event.stopPropagation();
        const willActivate = !active;
        onActivate();
        if (willActivate) {
          handleShow();
        } else {
          onHideTooltip();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
          handleShow();
        }
      }}
    >
      {text}
    </span>
  );
}

export function FocusedWritingReview({
  studentResponse,
  corrections,
  focusHighlights,
  focusConceptIds,
  skillTags,
  onPracticeConcept,
}: FocusedWritingReviewProps) {
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const hasActiveFocus = focusConceptIds.length > 0;

  const [activeStart, setActiveStart] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [pinnedStart, setPinnedStart] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveringTooltipRef = useRef(false);

  const review = useMemo(
    () =>
      prepareFocusedWritingReview(studentResponse, {
        focusHighlights,
        grammarCorrections: corrections,
        focusConceptIds,
        profile: skillProfile,
        skillTags,
      }),
    [
      studentResponse,
      corrections,
      focusHighlights,
      focusConceptIds,
      skillProfile,
      skillTags,
    ],
  );

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const dismissTooltip = useCallback(() => {
    anchorRef.current = null;
    setTooltip(null);
  }, []);

  const scheduleHideTooltip = useCallback(() => {
    if (pinnedStart != null) return;
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      if (hoveringTooltipRef.current) return;
      dismissTooltip();
    }, TOOLTIP_HIDE_DELAY_MS);
  }, [pinnedStart, clearHideTimeout, dismissTooltip]);

  const updateTooltipPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 180;
    setTooltip((current) => {
      if (!current) return current;
      return {
        ...current,
        rect,
        placement: computePlacement(rect, tooltipHeight),
      };
    });
  }, []);

  const showTooltip = useCallback(
    (element: HTMLElement, annotation: FocusAnnotation) => {
      clearHideTimeout();
      anchorRef.current = element;
      const rect = element.getBoundingClientRect();
      setTooltip({
        annotation,
        rect,
        placement: computePlacement(rect, 180),
      });
    },
    [clearHideTimeout],
  );

  const hideTooltip = useCallback(() => {
    scheduleHideTooltip();
  }, [scheduleHideTooltip]);

  const handleTooltipMouseEnter = useCallback(() => {
    hoveringTooltipRef.current = true;
    clearHideTimeout();
  }, [clearHideTimeout]);

  const handleTooltipMouseLeave = useCallback(() => {
    hoveringTooltipRef.current = false;
    scheduleHideTooltip();
  }, [scheduleHideTooltip]);

  useEffect(() => () => clearHideTimeout(), [clearHideTimeout]);

  useEffect(() => {
    if (!tooltip) return;
    const handleReposition = () => updateTooltipPosition();
    const scrollEl = scrollRef.current;
    scrollEl?.addEventListener("scroll", handleReposition, { passive: true });
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, { passive: true });
    const frame = requestAnimationFrame(updateTooltipPosition);
    return () => {
      cancelAnimationFrame(frame);
      scrollEl?.removeEventListener("scroll", handleReposition);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition);
    };
  }, [tooltip, updateTooltipPosition]);

  useEffect(() => {
    if (pinnedStart == null) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (tooltipRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      clearHideTimeout();
      setPinnedStart(null);
      setActiveStart(null);
      dismissTooltip();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [pinnedStart, clearHideTimeout, dismissTooltip]);

  if (!studentResponse.trim()) {
    return null;
  }

  const legendItems = [
    hasActiveFocus && review.focusCorrectCount > 0
      ? {
          key: "focus-correct",
          label: `Focus concept — correct (${review.focusCorrectCount})`,
          swatch: "border-emerald-600 bg-emerald-100/90",
        }
      : null,
    hasActiveFocus && review.focusMistakeCount > 0
      ? {
          key: "focus-mistake",
          label: `Focus concept — mistake (${review.focusMistakeCount})`,
          swatch: "border-blue-600 bg-blue-100/80",
        }
      : null,
    review.otherMistakeCount > 0
      ? {
          key: "other-mistake",
          label: `Mistake${hasActiveFocus ? " (outside current focus)" : ""} (${review.otherMistakeCount})`,
          swatch: "border-amber-500 bg-amber-100/90",
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    swatch: string;
  }>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your Response — Inline Review</CardTitle>
        <p className="text-sm text-gray-600">
          {hasActiveFocus
            ? "Hover any highlight for the fix, linked concept, and practice link. Green = correct focus usage; blue = focus mistake; amber = other issue."
            : "Hover any amber highlight for the suggested fix and linked concept. After analysis below, you will practise the top 2–3 concepts."}
        </p>
        {hasActiveFocus && (
          <div className="flex flex-wrap gap-2">
            {focusConceptIds.map((id) => {
              const concept = getConceptById(skillProfile, id);
              return (
                <Badge key={id} variant="outline" className="text-blue-800">
                  {concept?.label ?? id.replace(/_/g, " ")}
                </Badge>
              );
            })}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div
          ref={scrollRef}
          className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
        >
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">
            {review.segments.map((segment, index) => {
              if (segment.type === "plain") {
                return <span key={`plain-${index}`}>{segment.text}</span>;
              }
              const isActive = activeStart === segment.annotation.start;
              return (
                <AnnotationSpan
                  key={`annotation-${segment.annotation.start}-${index}`}
                  text={segment.text}
                  annotation={segment.annotation}
                  active={isActive}
                  onShowTooltip={showTooltip}
                  onHideTooltip={hideTooltip}
                  onActivate={() => {
                    const next =
                      activeStart === segment.annotation.start
                        ? null
                        : segment.annotation.start;
                    setActiveStart(next);
                    setPinnedStart(next);
                    if (next == null) {
                      clearHideTimeout();
                      dismissTooltip();
                    }
                  }}
                />
              );
            })}
          </div>
        </div>

        {legendItems.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
            {legendItems.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-3 w-6 rounded-sm border-b-2",
                    item.swatch,
                  )}
                />
                {item.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>

      {tooltip && (
        <FloatingFocusTooltip
          state={tooltip}
          tooltipRef={tooltipRef}
          profile={skillProfile}
          onPracticeConcept={onPracticeConcept}
          onMouseEnterTooltip={handleTooltipMouseEnter}
          onMouseLeaveTooltip={handleTooltipMouseLeave}
        />
      )}
    </Card>
  );
}
