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
import { prepareAnnotatedWriting } from "@/lib/annotated-writing";
import type { WritingAnnotation } from "@/lib/annotated-writing";
import type {
  GrammarCorrection,
  SkillTag,
  UserSkillProfile,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface AnnotatedWritingReviewProps {
  studentResponse: string;
  corrections: GrammarCorrection[];
  skillProfile: UserSkillProfile;
  skillTags?: SkillTag[];
  onPracticeConcept?: (conceptId: string) => void;
}

interface TooltipState {
  annotation: WritingAnnotation;
  rect: DOMRect;
  placement: "above" | "below";
}

const TOOLTIP_WIDTH = 288;
const TOOLTIP_GAP = 8;

function FloatingAnnotationTooltip({
  state,
  tooltipRef,
  onPracticeConcept,
}: {
  state: TooltipState;
  tooltipRef: RefObject<HTMLDivElement | null>;
  onPracticeConcept?: (conceptId: string) => void;
}) {
  const { annotation, rect, placement } = state;
  const { correction, conceptId, conceptLabel } = annotation;
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
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Suggested fix
      </p>
      <p className="mt-1 text-sm text-gray-900">
        <span className="text-red-600 line-through">{correction.original}</span>
        {" → "}
        <span className="font-medium text-green-700">{correction.corrected}</span>
      </p>
      <p className="mt-2 text-sm text-gray-600">{correction.reason}</p>
      {conceptId && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <Badge variant="outline" className="text-purple-800">
            {conceptLabel ?? conceptId.replace(/_/g, " ")}
          </Badge>
          {onPracticeConcept ? (
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
          ) : (
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
  annotation: WritingAnnotation;
  active: boolean;
  onActivate: () => void;
  onShowTooltip: (element: HTMLElement, annotation: WritingAnnotation) => void;
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
      className={cn(
        "cursor-help rounded-sm border-b-2 border-amber-500 bg-amber-100/90 px-0.5 text-amber-950",
        active && "ring-2 ring-amber-400 ring-offset-1",
      )}
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

export function AnnotatedWritingReview({
  studentResponse,
  corrections,
  skillProfile,
  skillTags,
  onPracticeConcept,
}: AnnotatedWritingReviewProps) {
  const [activeStart, setActiveStart] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [pinnedStart, setPinnedStart] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  const { segments, matchedCount, totalCorrections } = useMemo(
    () =>
      prepareAnnotatedWriting(
        studentResponse,
        corrections,
        skillProfile,
        skillTags,
      ),
    [studentResponse, corrections, skillProfile, skillTags],
  );

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
    (element: HTMLElement, annotation: WritingAnnotation) => {
      anchorRef.current = element;
      const rect = element.getBoundingClientRect();
      setTooltip({
        annotation,
        rect,
        placement: computePlacement(rect, 180),
      });
    },
    [],
  );

  const hideTooltip = useCallback(() => {
    if (pinnedStart != null) return;
    anchorRef.current = null;
    setTooltip(null);
  }, [pinnedStart]);

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
      setPinnedStart(null);
      setActiveStart(null);
      anchorRef.current = null;
      setTooltip(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [pinnedStart]);

  if (!studentResponse.trim() || corrections.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your Response — Inline Review</CardTitle>
        <p className="text-sm text-gray-600">
          Highlighted text marks a mistake from your draft. Hover (or tap on
          mobile) to see the correction, explanation, and linked Concept Lab
          skill.
        </p>
        {matchedCount < totalCorrections && (
          <p className="text-xs text-amber-700">
            {matchedCount} of {totalCorrections} corrections could be placed
            inline. See the list below for any that could not be matched.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div
          ref={scrollRef}
          className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
        >
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">
            {segments.map((segment, index) => {
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
                      anchorRef.current = null;
                      setTooltip(null);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-6 rounded-sm border-b-2 border-amber-500 bg-amber-100/90" />
            Mistake in your text
          </span>
        </div>
      </CardContent>

      {tooltip && (
        <FloatingAnnotationTooltip
          state={tooltip}
          tooltipRef={tooltipRef}
          onPracticeConcept={onPracticeConcept}
        />
      )}
    </Card>
  );
}
