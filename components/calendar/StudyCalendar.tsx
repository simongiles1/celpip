"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EventClickArg, EventDropArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { renderCalendarEventContent } from "@/components/calendar/renderCalendarEventContent";
import { getCurriculumUnit, getSubTestColor } from "@/data/curriculum";
import { useStudyStore } from "@/hooks/useStudyStore";
import type { StudyEvent } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

const FullCalendar = dynamic(
  () => import("@fullcalendar/react").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[600px] w-full" />,
  },
);

async function loadPlugins() {
  const [dayGrid, timeGrid, interaction] = await Promise.all([
    import("@fullcalendar/daygrid"),
    import("@fullcalendar/timegrid"),
    import("@fullcalendar/interaction"),
  ]);
  return [dayGrid.default, timeGrid.default, interaction.default];
}

export type CalendarView = "dayGridMonth" | "timeGridWeek";

interface StudyCalendarProps {
  onEventClick: (event: StudyEvent) => void;
  view: CalendarView;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export function StudyCalendar({ onEventClick, view }: StudyCalendarProps) {
  const events = useStudyStore((s) => s.events);
  const generated = useStudyStore((s) => s.generated);
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const updateEvent = useStudyStore((s) => s.updateEvent);
  const isMobile = useIsMobile();
  const [plugins, setPlugins] = useState<
    Awaited<ReturnType<typeof loadPlugins>> | null
  >(null);

  useEffect(() => {
    loadPlugins().then(setPlugins);
  }, []);

  const generatedEventIds = useMemo(
    () => new Set(generated.map((item) => item.eventId)),
    [generated],
  );

  const calendarEvents = useMemo(
    () =>
      events.map((evt) => {
        const unit = getCurriculumUnit(evt.curriculumUnitId, skillProfile);
        const title = unit
          ? unit.focusSubTest === "Vocabulary"
            ? `Vocabulary: ${unit.practiceType}`
            : `${unit.focusSubTest}: ${unit.practiceType}`
          : "Study Session";
        const color = getSubTestColor(unit?.focusSubTest ?? "");
        return {
          id: evt.id,
          title,
          start: evt.start,
          end: evt.end,
          backgroundColor: color,
          borderColor: color,
          editable: unit?.focusSubTest !== "EXAM",
          extendedProps: {
            studyEvent: evt,
            hasGenerated: generatedEventIds.has(evt.id),
            isCompleted: evt.status === "completed",
          },
        };
      }),
    [events, generatedEventIds, skillProfile],
  );

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      const studyEvent = info.event.extendedProps.studyEvent as StudyEvent;
      onEventClick(studyEvent);
    },
    [onEventClick],
  );

  const handleEventDrop = useCallback(
    (info: EventDropArg) => {
      const studyEvent = info.event.extendedProps.studyEvent as StudyEvent;
      updateEvent({
        ...studyEvent,
        start: info.event.start?.toISOString() ?? studyEvent.start,
        end: info.event.end?.toISOString() ?? studyEvent.end,
      });
    },
    [updateEvent],
  );

  const handleEventResize = useCallback(
    (info: EventResizeDoneArg) => {
      const studyEvent = info.event.extendedProps.studyEvent as StudyEvent;
      updateEvent({
        ...studyEvent,
        start: info.event.start?.toISOString() ?? studyEvent.start,
        end: info.event.end?.toISOString() ?? studyEvent.end,
      });
    },
    [updateEvent],
  );

  if (!plugins) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  return (
    <div className="study-calendar -mx-4 border-y border-gray-200 bg-white px-1 py-2 sm:mx-0 sm:rounded-xl sm:border sm:px-4 sm:py-4">
      <FullCalendar
        plugins={plugins}
        initialView={view}
        key={`${view}-${isMobile ? "mobile" : "desktop"}`}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "",
        }}
        titleFormat={
          isMobile
            ? { month: "short", day: "numeric" }
            : { month: "long", day: "numeric", year: "numeric" }
        }
        dayHeaderFormat={
          isMobile
            ? { weekday: "narrow", day: "numeric" }
            : { weekday: "short", month: "numeric", day: "numeric" }
        }
        slotLabelFormat={
          isMobile
            ? { hour: "numeric", meridiem: "narrow" }
            : { hour: "numeric", meridiem: "short" }
        }
        events={calendarEvents}
        editable
        droppable
        eventContent={renderCalendarEventContent}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        height="auto"
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        allDaySlot={false}
        nowIndicator
      />
    </div>
  );
}
