"use client";

import { create } from "zustand";
import { getCurriculumUnit } from "@/data/curriculum";
import {
  ensureVocabularyEvents,
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
import { migrateReadingAnswerIndices } from "@/lib/repair-reading-answer-indices";
import type {
  AppSettings,
  ConceptChatMessage,
  ConceptCustomization,
  GeneratedContent,
  GradedSession,
  GradeResponse,
  StudyEvent,
  UserPreferences,
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
  dailyVocabularyWordCount: number;
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
  setDailyVocabularyWordCount: (count: number) => void;
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

function clampVocabularyWordCount(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(20, Math.round(value)));
}

function persistEventsWithVocab(
  events: StudyEvent[],
  settings: AppSettings | null,
): StudyEvent[] {
  const merged = settings
    ? ensureVocabularyEvents(events, settings).events
    : events;
  persistEvents(merged);
  return merged;
}

function currentPreferences(get: () => StudyStore): UserPreferences {
  const state = get();
  return {
    geminiModel: state.geminiModel,
    preferredReadingClbBand: state.preferredReadingClbBand,
    dailyVocabularyWordCount: state.dailyVocabularyWordCount,
  };
}

export const useStudyStore = create<StudyStore>((set, get) => ({
  hydrated: false,
  settings: null,
  geminiModel: DEFAULT_GEMINI_MODEL,
  preferredReadingClbBand: 9,
  dailyVocabularyWordCount: 5,
  events: [],
  generated: [],
  graded: [],
  skillProfile: { observations: [], conceptScores: [], discoveredConcepts: [] },
  conceptCustomizations: [],
  selectedEventId: null,
  selectedConceptId: null,

  hydrate: async () => {
    const data = await loadAllData();
    const migrated = migrateReadingAnswerIndices({
      generated: data.generated,
      graded: data.graded,
    });
    if (migrated.changed) {
      await saveAllData({
        generated: migrated.generated,
        graded: migrated.graded,
      });
    }

    let events = data.events;
    if (data.settings) {
      const vocabResult = ensureVocabularyEvents(events, data.settings);
      if (vocabResult.changed) {
        events = vocabResult.events;
        await saveAllData({ events });
      }
    }

    set({
      hydrated: true,
      settings: data.settings,
      geminiModel: data.preferences.geminiModel,
      preferredReadingClbBand: clampClbBand(
        data.preferences.preferredReadingClbBand,
      ),
      dailyVocabularyWordCount: clampVocabularyWordCount(
        data.preferences.dailyVocabularyWordCount,
      ),
      events,
      generated: migrated.generated,
      graded: migrated.graded,
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
    persistPreferences({ ...currentPreferences(get), geminiModel: model });
    set({ geminiModel: model });
  },

  setPreferredReadingClbBand: (band) => {
    const clamped = clampClbBand(band);
    persistPreferences({
      ...currentPreferences(get),
      preferredReadingClbBand: clamped,
    });
    set({ preferredReadingClbBand: clamped });
  },

  setDailyVocabularyWordCount: (count) => {
    const clamped = clampVocabularyWordCount(count);
    persistPreferences({
      ...currentPreferences(get),
      dailyVocabularyWordCount: clamped,
    });
    set({ dailyVocabularyWordCount: clamped });
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
    const { settings, events } = get();
    const next = events.map((e) => (e.id === event.id ? event : e));
    const merged = persistEventsWithVocab(next, settings);
    set({ events: merged });
  },

  updateEvents: (events) => {
    const merged = persistEventsWithVocab(events, get().settings);
    set({ events: merged });
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
    const { settings, events } = get();
    const next = events.map((e) =>
      e.id === eventId ? { ...e, status: "completed" as const } : e,
    );
    const merged = persistEventsWithVocab(next, settings);
    set({ events: merged });
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
    const merged = persistEventsWithVocab(updated, get().settings);
    set({ events: merged, selectedEventId: event.id });
    return { start, end };
  },

  reconcileConceptInjections: () => {
    const { events, skillProfile, settings } = get();
    const updated = injectConceptSessions(events, skillProfile);
    if (
      updated.length !== events.length ||
      updated.some((e, i) => e.id !== events[i]?.id)
    ) {
      const merged = persistEventsWithVocab(updated, settings);
      set({ events: merged });
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
