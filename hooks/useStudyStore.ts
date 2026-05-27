"use client";

import { create } from "zustand";
import { getCurriculumUnit } from "@/data/curriculum";
import {
  generateSchedule,
  injectConceptSessions,
  nextManualConceptSlot,
  regenerateSchedule,
  shouldReconcileConceptInjections,
} from "@/lib/schedule";
import { applySkillTags } from "@/lib/skill-profile";
import type { GeminiModel } from "@/lib/gemini";
import { DEFAULT_GEMINI_MODEL } from "@/lib/gemini";
import {
  clearAllData,
  loadAllData,
  persistConceptCustomizations,
  persistEvents,
  persistGenerated,
  persistGraded,
  persistPreferences,
  persistSkillProfile,
  saveAllData,
} from "@/lib/storage";
import type {
  AppSettings,
  ConceptChatMessage,
  ConceptCustomization,
  GeneratedContent,
  GradedSession,
  GradeResponse,
  StudyEvent,
  UserSkillProfile,
} from "@/lib/types";
import { upsertConceptCustomization } from "@/lib/concept-customizations";
import { formatDateISO } from "@/lib/utils";
import { parseISO } from "date-fns";

interface StudyStore {
  hydrated: boolean;
  settings: AppSettings | null;
  geminiModel: GeminiModel;
  preferredReadingClbBand: number;
  events: StudyEvent[];
  generated: GeneratedContent[];
  graded: GradedSession[];
  skillProfile: UserSkillProfile;
  conceptCustomizations: ConceptCustomization[];
  selectedEventId: string | null;
  selectedConceptId: string | null;

  hydrate: () => Promise<void>;
  initializeProgram: (examDate: string) => Promise<void>;
  rebuildSchedule: () => Promise<void>;
  resetStudyProgram: () => Promise<void>;
  setGeminiModel: (model: GeminiModel) => void;
  setPreferredReadingClbBand: (band: number) => void;
  setSelectedEventId: (id: string | null) => void;
  setSelectedConceptId: (id: string | null) => void;
  updateEvent: (event: StudyEvent) => void;
  updateEvents: (events: StudyEvent[]) => void;
  addGenerated: (content: GeneratedContent) => void;
  updateReadingAnswers: (
    eventId: string,
    answers: Record<string, number>,
  ) => void;
  removeGeneratedForEvent: (eventId: string) => void;
  getGeneratedForEvent: (eventId: string) => GeneratedContent | undefined;
  addGraded: (
    session: GradedSession,
    gradeResult?: Pick<GradeResponse, "skillTags">,
    track?: "subtest" | "concept",
  ) => void;
  getGradedForEvent: (eventId: string) => GradedSession | undefined;
  markEventCompleted: (eventId: string) => void;
  scheduleConceptDrill: (conceptId: string) => { start: Date; end: Date };
  reconcileConceptInjections: () => void;
  applyConceptChatUpdates: (
    conceptId: string,
    userMessage: ConceptChatMessage,
    assistantMessage: ConceptChatMessage,
    updates?: Partial<
      Pick<
        ConceptCustomization,
        "instructionMarkdown" | "drillConstraints" | "descriptionOverride"
      >
    >,
  ) => void;
}

function clampClbBand(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 9;
  return Math.max(6, Math.min(12, Math.round(value)));
}

export const useStudyStore = create<StudyStore>((set, get) => ({
  hydrated: false,
  settings: null,
  geminiModel: DEFAULT_GEMINI_MODEL,
  preferredReadingClbBand: 9,
  events: [],
  generated: [],
  graded: [],
  skillProfile: { observations: [], conceptScores: [], discoveredConcepts: [] },
  conceptCustomizations: [],
  selectedEventId: null,
  selectedConceptId: null,

  hydrate: async () => {
    const data = await loadAllData();
    set({
      hydrated: true,
      settings: data.settings,
      geminiModel: data.preferences.geminiModel,
      preferredReadingClbBand: clampClbBand(
        data.preferences.preferredReadingClbBand,
      ),
      events: data.events,
      generated: data.generated,
      graded: data.graded,
      skillProfile: data.skillProfile,
      conceptCustomizations: data.conceptCustomizations ?? [],
    });
  },

  rebuildSchedule: async () => {
    const { settings, events: previousEvents, generated, skillProfile } = get();
    if (!settings) {
      throw new Error("No study program settings found.");
    }

    const { events, settings: updatedSettings } = regenerateSchedule(settings);
    const eventIds = new Set(events.map((event) => event.id));
    const statusByDayUnit = new Map(
      previousEvents.map((event) => [
        `${formatDateISO(parseISO(event.start))}-${event.curriculumUnitId}`,
        event.status,
      ]),
    );

    const mergedEvents = events.map((event) => {
      const key = `${formatDateISO(parseISO(event.start))}-${event.curriculumUnitId}`;
      const previousStatus = statusByDayUnit.get(key);
      if (previousStatus && previousStatus !== "scheduled") {
        return { ...event, status: previousStatus };
      }
      return event;
    });

    const withConcepts = injectConceptSessions(mergedEvents, skillProfile);
    const filteredGenerated = generated.filter((item) =>
      eventIds.has(item.eventId),
    );

    await saveAllData({
      settings: updatedSettings,
      events: withConcepts,
      generated: filteredGenerated,
    });

    set({
      settings: updatedSettings,
      events: withConcepts,
      generated: filteredGenerated,
    });
  },

  setGeminiModel: (model) => {
    persistPreferences({
      geminiModel: model,
      preferredReadingClbBand: get().preferredReadingClbBand,
    });
    set({ geminiModel: model });
  },

  setPreferredReadingClbBand: (band) => {
    const clamped = clampClbBand(band);
    persistPreferences({
      geminiModel: get().geminiModel,
      preferredReadingClbBand: clamped,
    });
    set({ preferredReadingClbBand: clamped });
  },

  initializeProgram: async (examDate: string) => {
    const { events, settings } = generateSchedule(examDate);
    const emptyProfile = {
      observations: [],
      conceptScores: [],
      discoveredConcepts: [],
    };

    await saveAllData({
      settings,
      events,
      generated: [],
      graded: [],
      skillProfile: emptyProfile,
    });

    set({
      settings,
      events,
      generated: [],
      graded: [],
      skillProfile: emptyProfile,
    });
  },

  resetStudyProgram: async () => {
    await clearAllData();
    set({
      settings: null,
      events: [],
      generated: [],
      graded: [],
      skillProfile: { observations: [], conceptScores: [], discoveredConcepts: [] },
      conceptCustomizations: [],
      selectedEventId: null,
      selectedConceptId: null,
    });
  },

  setSelectedEventId: (id) => set({ selectedEventId: id }),
  setSelectedConceptId: (id) => set({ selectedConceptId: id }),

  updateEvent: (event) => {
    const events = get().events.map((e) => (e.id === event.id ? event : e));
    persistEvents(events);
    set({ events });
  },

  updateEvents: (events) => {
    persistEvents(events);
    set({ events });
  },

  addGenerated: (content) => {
    const generated = [
      ...get().generated.filter((g) => g.eventId !== content.eventId),
      content,
    ];
    persistGenerated(generated);
    set({ generated });
  },

  updateReadingAnswers: (eventId, answers) => {
    const existing = get().generated.find((g) => g.eventId === eventId);
    if (!existing) return;

    const updated: GeneratedContent = {
      ...existing,
      readingAnswers:
        Object.keys(answers).length > 0 ? answers : undefined,
    };
    const generated = [
      ...get().generated.filter((g) => g.eventId !== eventId),
      updated,
    ];
    persistGenerated(generated);
    set({ generated });
  },

  removeGeneratedForEvent: (eventId) => {
    const generated = get().generated.filter((g) => g.eventId !== eventId);
    persistGenerated(generated);
    set({ generated });
  },

  getGeneratedForEvent: (eventId) =>
    get().generated.find((g) => g.eventId === eventId),

  addGraded: (session, gradeResult, track = "subtest") => {
    const previousCount = get().graded.length;
    const graded = [
      ...get().graded.filter((g) => g.eventId !== session.eventId),
      session,
    ];
    persistGraded(graded);

    let skillProfile = get().skillProfile;
    if (gradeResult?.skillTags?.length) {
      skillProfile = applySkillTags(skillProfile, {
        eventId: session.eventId,
        track,
        band: session.estimatedBand,
        tags: gradeResult.skillTags,
      });
      persistSkillProfile(skillProfile);
    }

    set({ graded, skillProfile });

    if (shouldReconcileConceptInjections(graded.length, previousCount)) {
      get().reconcileConceptInjections();
    }
  },

  getGradedForEvent: (eventId) =>
    get().graded.find((g) => g.eventId === eventId),

  markEventCompleted: (eventId) => {
    const events = get().events.map((e) =>
      e.id === eventId ? { ...e, status: "completed" as const } : e,
    );
    persistEvents(events);
    set({ events });
  },

  scheduleConceptDrill: (conceptId: string) => {
    const { events } = get();
    const { start, end } = nextManualConceptSlot();

    const withoutDuplicate = events.filter(
      (e) =>
        !(
          e.conceptId === conceptId &&
          e.status === "scheduled" &&
          e.id.startsWith("evt-concept-lab-")
        ),
    );

    const event: StudyEvent = {
      id: `evt-concept-lab-${conceptId}-${Date.now()}`,
      curriculumUnitId: `concept-unit-${conceptId}`,
      conceptId,
      start: start.toISOString(),
      end: end.toISOString(),
      status: "scheduled",
    };

    const updated = [...withoutDuplicate, event].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
    persistEvents(updated);
    set({ events: updated, selectedEventId: event.id });
    return { start, end };
  },

  reconcileConceptInjections: () => {
    const { events, skillProfile } = get();
    const updated = injectConceptSessions(events, skillProfile);
    if (
      updated.length !== events.length ||
      updated.some((e, i) => e.id !== events[i]?.id)
    ) {
      persistEvents(updated);
      set({ events: updated });
    }
  },

  applyConceptChatUpdates: (conceptId, userMessage, assistantMessage, updates) => {
    const { conceptCustomizations } = get();
    const existing = conceptCustomizations.find((c) => c.conceptId === conceptId);
    const chatMessages = [
      ...(existing?.chatMessages ?? []),
      userMessage,
      assistantMessage,
    ];
    const next = upsertConceptCustomization(conceptCustomizations, conceptId, {
      ...updates,
      chatMessages,
    });
    persistConceptCustomizations(next);
    set({ conceptCustomizations: next });
  },
}));

export function useSelectedEvent() {
  const selectedEventId = useStudyStore((s) => s.selectedEventId);
  const events = useStudyStore((s) => s.events);
  const skillProfile = useStudyStore((s) => s.skillProfile);
  const event = events.find((e) => e.id === selectedEventId);
  const unit = event
    ? getCurriculumUnit(event.curriculumUnitId, skillProfile)
    : undefined;
  return { event, unit };
}
