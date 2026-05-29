import { EXAM_UNIT, STUDY_UNITS, VOCABULARY_UNIT_ID } from "@/data/curriculum";
import { CONCEPT_UNIT_PREFIX } from "@/lib/concept-units";
import {
  getLastConceptPracticeDate,
  getWeakConcepts,
} from "@/lib/skill-profile";
import type { AppSettings, StudyEvent, UserSkillProfile } from "@/lib/types";
import { formatDateISO } from "@/lib/utils";
import {
  addDays,
  differenceInCalendarDays,
  parseISO,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from "date-fns";

const DEFAULT_DURATION_MIN = 45;
const VOCABULARY_DURATION_MIN = 30;
const SESSION_TIMES = [
  { hour: 9, minute: 0 },
  { hour: 10, minute: 0 },
];
const VOCABULARY_TIME = { hour: 11, minute: 0 };

export const CONCEPT_DURATION_MIN = 25;
const MIN_DAYS_BETWEEN_INJECTIONS = 3;
const CONCEPT_COOLDOWN_DAYS = 5;

/** Calendar week view shows 7:00–21:00 (see StudyCalendar slotMinTime/slotMaxTime). */
const CALENDAR_VISIBLE_START_HOUR = 7;
const CALENDAR_VISIBLE_END_HOUR = 21;

function conceptSlotFitsCalendar(start: Date): boolean {
  const end = new Date(start.getTime() + CONCEPT_DURATION_MIN * 60_000);
  if (start.getHours() < CALENDAR_VISIBLE_START_HOUR) return false;
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  return endMinutes <= CALENDAR_VISIBLE_END_HOUR * 60;
}

/** Next slot for a user-scheduled concept drill, kept inside the calendar's visible hours. */
export function nextManualConceptSlot(from: Date = new Date()): {
  start: Date;
  end: Date;
} {
  let start = new Date(from);
  start.setMinutes(start.getMinutes() + 5, 0, 0);

  if (!conceptSlotFitsCalendar(start)) {
    const todayNine = withTime(from, 9, 0);
    if (from < todayNine && conceptSlotFitsCalendar(todayNine)) {
      start = todayNine;
    } else {
      start = withTime(addDays(startOfDay(from), 1), 14, 0);
    }
  }

  const end = new Date(start.getTime() + CONCEPT_DURATION_MIN * 60_000);
  return { start, end };
}

function startOfDay(date: Date): Date {
  return setMilliseconds(setSeconds(setMinutes(setHours(date, 0), 0), 0), 0);
}

function withTime(date: Date, hour: number, minute: number): Date {
  return setMilliseconds(
    setSeconds(setMinutes(setHours(startOfDay(date), hour), minute), 0),
    0,
  );
}

function pickFromPool(
  pool: { id: string }[],
  dayIndex: number,
  dayCount: number,
): string {
  if (dayCount >= pool.length) {
    return pool[dayIndex % pool.length].id;
  }
  const index = Math.floor((dayIndex * pool.length) / dayCount);
  return pool[Math.min(index, pool.length - 1)].id;
}

/** Three sessions per day: writing at 9am, reading at 10am, vocabulary at 11am. */
function distributeUnits(dayCount: number): string[] {
  if (dayCount <= 0) return [];

  const writingUnits = STUDY_UNITS.filter((u) => u.focusSubTest === "Writing");
  const readingUnits = STUDY_UNITS.filter((u) => u.focusSubTest === "Reading");

  const result: string[] = [];
  for (let d = 0; d < dayCount; d++) {
    result.push(
      pickFromPool(writingUnits, d, dayCount),
      pickFromPool(readingUnits, d, dayCount),
    );
  }
  return result;
}

export function generateSchedule(
  examDateStr: string,
  today: Date = new Date(),
): { events: StudyEvent[]; settings: AppSettings } {
  const examDate = startOfDay(parseISO(examDateStr));
  const programStart = startOfDay(today);

  if (examDate <= programStart) {
    throw new Error("Exam date must be after today.");
  }

  const studyDays: Date[] = [];
  let cursor = programStart;
  while (cursor < examDate) {
    studyDays.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }

  const unitIds = distributeUnits(studyDays.length);

  const events: StudyEvent[] = [];
  studyDays.forEach((day, dayIndex) => {
    SESSION_TIMES.forEach((time, sessionIndex) => {
      const unitIndex = dayIndex * 2 + sessionIndex;
      const unitId = unitIds[unitIndex];
      if (!unitId) return;

      const start = withTime(day, time.hour, time.minute);
      const end = new Date(start.getTime() + DEFAULT_DURATION_MIN * 60 * 1000);

      events.push({
        id: `evt-${formatDateISO(day)}-${sessionIndex}-${unitId}`,
        curriculumUnitId: unitId,
        start: start.toISOString(),
        end: end.toISOString(),
        status: "scheduled",
      });
    });

    const vocabStart = withTime(day, VOCABULARY_TIME.hour, VOCABULARY_TIME.minute);
    const vocabEnd = new Date(
      vocabStart.getTime() + VOCABULARY_DURATION_MIN * 60 * 1000,
    );
    events.push({
      id: `evt-${formatDateISO(day)}-vocab-${VOCABULARY_UNIT_ID}`,
      curriculumUnitId: VOCABULARY_UNIT_ID,
      start: vocabStart.toISOString(),
      end: vocabEnd.toISOString(),
      status: "scheduled",
    });
  });

  events.push({
    id: `evt-exam-${formatDateISO(examDate)}`,
    curriculumUnitId: EXAM_UNIT.id,
    start: withTime(examDate, 9, 0).toISOString(),
    end: withTime(examDate, 12, 0).toISOString(),
    status: "scheduled",
  });

  const settings: AppSettings = {
    examDate: formatDateISO(examDate),
    programStartDate: formatDateISO(programStart),
    defaultSessionDurationMin: DEFAULT_DURATION_MIN,
  };

  return { events, settings };
}

/** Add daily vocabulary events for study days that lack them (e.g. after a schedule upgrade). */
export function ensureVocabularyEvents(
  events: StudyEvent[],
  settings: AppSettings,
): { events: StudyEvent[]; changed: boolean } {
  const examDate = startOfDay(parseISO(settings.examDate));
  const programStart = startOfDay(parseISO(settings.programStartDate));

  const vocabDates = new Set(
    events
      .filter((e) => e.curriculumUnitId === VOCABULARY_UNIT_ID)
      .map((e) => formatDateISO(parseISO(e.start))),
  );

  const additions: StudyEvent[] = [];
  let cursor = programStart;
  while (cursor < examDate) {
    const dateKey = formatDateISO(cursor);
    if (!vocabDates.has(dateKey)) {
      const vocabStart = withTime(
        cursor,
        VOCABULARY_TIME.hour,
        VOCABULARY_TIME.minute,
      );
      const vocabEnd = new Date(
        vocabStart.getTime() + VOCABULARY_DURATION_MIN * 60 * 1000,
      );
      additions.push({
        id: `evt-${dateKey}-vocab-${VOCABULARY_UNIT_ID}`,
        curriculumUnitId: VOCABULARY_UNIT_ID,
        start: vocabStart.toISOString(),
        end: vocabEnd.toISOString(),
        status: "scheduled",
      });
    }
    cursor = addDays(cursor, 1);
  }

  if (additions.length === 0) {
    return { events, changed: false };
  }

  return {
    events: [...events, ...additions].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    ),
    changed: true,
  };
}

/** Rebuild the calendar from saved program dates (e.g. after schedule logic changes). */
export function regenerateSchedule(settings: AppSettings): {
  events: StudyEvent[];
  settings: AppSettings;
} {
  return generateSchedule(settings.examDate, parseISO(settings.programStartDate));
}

export function daysUntilExam(examDateStr: string, today: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(examDateStr), startOfDay(today));
}

export function studyDayCount(
  programStartStr: string,
  examDateStr: string,
): number {
  return differenceInCalendarDays(parseISO(examDateStr), parseISO(programStartStr));
}

function isConceptEvent(event: StudyEvent): boolean {
  return (
    event.conceptId !== undefined ||
    event.curriculumUnitId.startsWith(CONCEPT_UNIT_PREFIX)
  );
}

function findInjectionAnchor(events: StudyEvent[]): Date | null {
  const studyEvents = events
    .filter((e) => !e.curriculumUnitId.includes("exam"))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  if (studyEvents.length === 0) return null;

  const lastConcept = studyEvents
    .filter(isConceptEvent)
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())[0];

  if (lastConcept) {
    return addDays(parseISO(lastConcept.start), MIN_DAYS_BETWEEN_INJECTIONS);
  }

  const first = studyEvents[0];
  return addDays(parseISO(first.start), 2);
}

function pickConceptForInjection(profile: UserSkillProfile): string | null {
  const weak = getWeakConcepts(profile, 10);
  const now = new Date();

  for (const { concept } of weak) {
    const lastPractice = getLastConceptPracticeDate(profile, concept.id);
    if (!lastPractice) return concept.id;
    const daysSince = differenceInCalendarDays(now, lastPractice);
    if (daysSince >= CONCEPT_COOLDOWN_DAYS) return concept.id;
  }

  return weak[0]?.concept.id ?? null;
}

export function injectConceptSessions(
  events: StudyEvent[],
  profile: UserSkillProfile,
): StudyEvent[] {
  const withoutStaleConcepts = events.filter((e) => {
    if (!isConceptEvent(e)) return true;
    return e.status === "completed" || e.status === "in_progress";
  });

  const conceptId = pickConceptForInjection(profile);
  if (!conceptId) return withoutStaleConcepts;

  const anchor = findInjectionAnchor(withoutStaleConcepts);
  if (!anchor) return withoutStaleConcepts;

  const examEvent = withoutStaleConcepts.find((e) =>
    e.curriculumUnitId.includes("exam"),
  );
  const examDate = examEvent ? parseISO(examEvent.start) : null;

  if (examDate && anchor >= examDate) return withoutStaleConcepts;

  const alreadyScheduled = withoutStaleConcepts.some(
    (e) =>
      isConceptEvent(e) &&
      e.status === "scheduled" &&
      (e.conceptId === conceptId ||
        e.curriculumUnitId === `${CONCEPT_UNIT_PREFIX}${conceptId}`),
  );
  if (alreadyScheduled) return withoutStaleConcepts;

  const start = new Date(anchor);
  start.setHours(14, 0, 0, 0);
  const end = new Date(start.getTime() + CONCEPT_DURATION_MIN * 60 * 1000);

  const newEvent: StudyEvent = {
    id: `evt-concept-${conceptId}-${formatDateISO(start)}`,
    curriculumUnitId: `${CONCEPT_UNIT_PREFIX}${conceptId}`,
    conceptId,
    start: start.toISOString(),
    end: end.toISOString(),
    status: "scheduled",
  };

  return [...withoutStaleConcepts, newEvent].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}

export function shouldReconcileConceptInjections(
  gradedCount: number,
  previousGradedCount: number,
): boolean {
  return gradedCount > previousGradedCount && gradedCount % 3 === 0;
}
