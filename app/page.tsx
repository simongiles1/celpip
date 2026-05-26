"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, CircleCheckBig, FileText } from "lucide-react";
import {
  StudyCalendar,
  type CalendarView,
} from "@/components/calendar/StudyCalendar";
import { SessionModal } from "@/components/session/SessionModal";
import { Badge } from "@/components/ui/badge";
import { useStudyStore } from "@/hooks/useStudyStore";
import { daysUntilExam } from "@/lib/schedule";
import type { StudyEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEGEND = [
  { label: "Writing", color: "#3b82f6" },
  { label: "Reading", color: "#22c55e" },
  { label: "Review", color: "#f59e0b" },
  { label: "Exam", color: "#dc2626" },
] as const;

const STATUS_LEGEND = [
  { label: "Content ready", Icon: FileText },
  { label: "Completed", Icon: CircleCheckBig },
] as const;

export default function HomePage() {
  const settings = useStudyStore((s) => s.settings);
  const events = useStudyStore((s) => s.events);
  const setSelectedEventId = useStudyStore((s) => s.setSelectedEventId);
  const [view, setView] = useState<CalendarView>("timeGridWeek");

  const handleEventClick = (event: StudyEvent) => {
    setSelectedEventId(event.id);
  };

  if (!settings) return null;

  const daysLeft = daysUntilExam(settings.examDate);
  const completedCount = events.filter((e) => e.status === "completed").length;
  const totalStudy = events.filter((e) => e.curriculumUnitId !== "w4-exam").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex rounded-md bg-gray-100 p-0.5">
            {(
              [
                { id: "dayGridMonth" as const, label: "Month" },
                { id: "timeGridWeek" as const, label: "Week" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                  view === option.id
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:text-gray-900",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="hidden h-4 w-px bg-gray-200 sm:block" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {LEGEND.map((item) => (
              <span
                key={item.label}
                className="flex items-center gap-1 text-xs text-gray-600"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
          <div className="hidden h-4 w-px bg-gray-200 sm:block" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {STATUS_LEGEND.map((item) => (
              <span
                key={item.label}
                className="flex items-center gap-1 text-xs text-gray-600"
              >
                <item.Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1 px-2 py-0.5 text-xs">
            <CalendarDays className="h-3 w-3" />
            {daysLeft} days until exam
          </Badge>
          <Badge variant="secondary" className="px-2 py-0.5 text-xs">
            Exam: {format(parseISO(settings.examDate), "MMM d, yyyy")}
          </Badge>
          <Badge variant="success" className="px-2 py-0.5 text-xs">
            {completedCount}/{totalStudy} completed
          </Badge>
        </div>
      </div>

      <StudyCalendar view={view} onEventClick={handleEventClick} />
      <SessionModal />
    </div>
  );
}
