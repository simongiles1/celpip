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
import {
  graduateFocusConcepts,
  processFocusGradeResult,
  recordFocusPractice,
  setActiveFocusSet,
  setLastFocusAssessment,
  withFocusModel,
} from "@/lib/focus-model";
import { applySkillTags, addDiscoveredConcept as mergeDiscoveredConcept, withWritingConceptFrequency } from "@/lib/skill-profile";
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
  saveSkillProfile,
} from "@/lib/storage";
import { migrateReadingAnswerIndices } from "@/lib/repair-reading-answer-indices";
import {
  isReadingSubmissionEnvelope,
  withReadingQuestionChatMessages,
} from "@/lib/reading-submission";
import type {
  AppSettings,
  ConceptChatContext,
  ConceptChatMessage,
  ConceptCustomization,
  ConceptDefinition,
  GeneratedContent,
  GradedSession,
  GradeResponse,
  StudyEvent,
  UserPreferences,
  UserSkillProfile,
  VocabularyProgress,
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
  refreshFromServer: () => Promise<void>;
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
  updateVocabularyProgress: (
    eventId: string,
    progress: VocabularyProgress,
  ) => void;
  removeGeneratedForEvent: (eventId: string) => void;
  getGeneratedForEvent: (eventId: string) => GeneratedContent | undefined;
  addGraded: (
    session: GradedSession,
    gradeResult?: Pick<GradeResponse, "skillTags">,
    track?: "subtest" | "concept" | "focus",
  ) => void;
  completeFocusedAssessment: (
    session: GradedSession,
    gradeResult: Pick<GradeResponse, "skillTags" | "focusRankings">,
  ) => Promise<{
    graduated: string[];
    nextFocus: string[];
    rationale: import("@/lib/types").FocusSelectionRationale[];
  }>;
  getGradedForEvent: (eventId: string) => GradedSession | undefined;
  setReadingQuestionChatMessages: (
    passageEventId: string,
    questionIndex: number,
    messages: ConceptChatMessage[],
  ) => void;
  markEventCompleted: (eventId: string) => void;
  scheduleConceptDrill: (conceptId: string) => { start: Date; end: Date };
  reconcileConceptInjections: () => void;
  applyConceptChatUpdates: (
    conceptId: string,
    chatContext: ConceptChatContext,
    userMessage: ConceptChatMessage,
    assistantMessage: ConceptChatMessage,
    updates?: Partial<
      Pick<
        ConceptCustomization,
        | "instructionMarkdown"
        | "drillConstraints"
        | "gradingFeedbackConstraints"
        | "descriptionOverride"
      >
    >,
  ) => void;
  addDiscoveredConcept: (
    input: Omit<ConceptDefinition, "source">,
  ) => { conceptId?: string; error?: string };
  setActiveFocus: (conceptIds: string[]) => void;
  recordFocusPractice: (conceptId: string) => void;
  graduateConcepts: (conceptIds: string[]) => void;
  processFocusedGrade: (
    eventId: string,
    gradeResult: Pick<GradeResponse, "skillTags" | "focusRankings">,
  ) => {
    graduated: string[];
    nextFocus: string[];
    rationale: import("@/lib/types").FocusSelectionRationale[];
  };
  setLastFocusAssessment: (eventId: string) => void;
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

type LoadedStoreSlice = Pick<
  StudyStore,
  | "settings"
  | "geminiModel"
  | "preferredReadingClbBand"
  | "dailyVocabularyWordCount"
  | "events"
  | "generated"
  | "graded"
  | "skillProfile"
  | "conceptCustomizations"
>;

async function loadStudyStateFromServer(options: {
  persistRepairs: boolean;
}): Promise<LoadedStoreSlice> {
  const data = await loadAllData();
  const migrated = migrateReadingAnswerIndices({
    generated: data.generated,
    graded: data.graded,
  });
  if (options.persistRepairs && migrated.changed) {
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
      if (options.persistRepairs) {
        await saveAllData({ events });
      }
    }
  }

  let skillProfile = withWritingConceptFrequency(
    data.skillProfile,
    migrated.graded,
  );
  const withFocus = withFocusModel(skillProfile);
  if (withFocus !== skillProfile) {
    skillProfile = withFocus;
    if (options.persistRepairs) {
      await saveSkillProfile(skillProfile);
    }
  } else if (options.persistRepairs && skillProfile !== data.skillProfile) {
    await saveSkillProfile(skillProfile);
  }

  return {
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
    skillProfile,
    conceptCustomizations: data.conceptCustomizations ?? [],
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
  skillProfile: {
    observations: [],
    conceptScores: [],
    discoveredConcepts: [],
    writingConceptStats: {},
  },
  conceptCustomizations: [],
  selectedEventId: null,
  selectedConceptId: null,

  hydrate: async () => {
    const slice = await loadStudyStateFromServer({ persistRepairs: true });
    set({ hydrated: true, ...slice });
  },

  refreshFromServer: async () => {
    if (!get().hydrated) return;
    const slice = await loadStudyStateFromServer({ persistRepairs: false });
    set(slice);
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
      writingConceptStats: {},
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
      skillProfile: { observations: [], conceptScores: [], discoveredConcepts: [], writingConceptStats: {} },
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

  updateVocabularyProgress: (eventId, progress) => {
    const existing = get().generated.find((g) => g.eventId === eventId);
    if (!existing) return;

    const hasAnswers = Object.values(progress.answersByWord).some(
      (wordAnswers) => wordAnswers.some((answer) => answer.checked),
    );
    const updated: GeneratedContent = {
      ...existing,
      vocabularyProgress: hasAnswers ? progress : undefined,
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

  addGraded: (session, gradeResult, track: "subtest" | "concept" | "focus" = "subtest") => {
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
    }
    skillProfile = withWritingConceptFrequency(skillProfile, graded);
    persistSkillProfile(skillProfile);

    set({ graded, skillProfile });

    if (shouldReconcileConceptInjections(graded.length, previousCount)) {
      get().reconcileConceptInjections();
    }
  },

  completeFocusedAssessment: async (session, gradeResult) => {
    const previousCount = get().graded.length;
    const graded = [
      ...get().graded.filter((g) => g.eventId !== session.eventId),
      session,
    ];

    let skillProfile = get().skillProfile;
    if (gradeResult.skillTags?.length) {
      skillProfile = applySkillTags(skillProfile, {
        eventId: session.eventId,
        track: "focus",
        band: session.estimatedBand,
        tags: gradeResult.skillTags,
      });
    }
    skillProfile = withWritingConceptFrequency(skillProfile, graded);
    skillProfile = setLastFocusAssessment(skillProfile, session.eventId);
    const focusResult = processFocusGradeResult(skillProfile, gradeResult, graded);
    skillProfile = focusResult.profile;

    await saveAllData({ graded, skillProfile });

    set({ graded, skillProfile });

    if (shouldReconcileConceptInjections(graded.length, previousCount)) {
      get().reconcileConceptInjections();
    }

    return {
      graduated: focusResult.graduated,
      nextFocus: focusResult.nextFocus,
      rationale: focusResult.rationale,
    };
  },

  getGradedForEvent: (eventId) =>
    get().graded.find((g) => g.eventId === eventId),

  setReadingQuestionChatMessages: (passageEventId, questionIndex, messages) => {
    const graded = get().graded;
    const sessionIndex = graded.findIndex((g) => g.eventId === passageEventId);
    if (sessionIndex < 0) return;

    const session = graded[sessionIndex];
    if (!isReadingSubmissionEnvelope(session.studentSubmission)) return;

    const updatedSubmission = withReadingQuestionChatMessages(
      session.studentSubmission,
      questionIndex,
      messages,
    );
    const nextGraded = [...graded];
    nextGraded[sessionIndex] = {
      ...session,
      studentSubmission: updatedSubmission,
    };
    persistGraded(nextGraded);
    set({ graded: nextGraded });
  },

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

  applyConceptChatUpdates: (
    conceptId,
    chatContext,
    userMessage,
    assistantMessage,
    updates,
  ) => {
    const { conceptCustomizations } = get();
    const existing = conceptCustomizations.find((c) => c.conceptId === conceptId);
    const messageKey =
      chatContext === "instructions"
        ? "instructionChatMessages"
        : "exerciseChatMessages";
    const priorMessages =
      chatContext === "instructions"
        ? (existing?.instructionChatMessages ?? existing?.chatMessages ?? [])
        : (existing?.exerciseChatMessages ?? []);
    const nextMessages = [...priorMessages, userMessage, assistantMessage];
    const next = upsertConceptCustomization(conceptCustomizations, conceptId, {
      ...updates,
      [messageKey]: nextMessages,
    });
    persistConceptCustomizations(next);
    set({ conceptCustomizations: next });
  },

  addDiscoveredConcept: (input) => {
    const { skillProfile } = get();
    const { profile, added, error } = mergeDiscoveredConcept(skillProfile, input);
    if (!added) {
      return { error };
    }
    const conceptId =
      profile.discoveredConcepts[profile.discoveredConcepts.length - 1]?.id;
    persistSkillProfile(profile);
    set({ skillProfile: profile });
    return { conceptId };
  },

  setActiveFocus: (conceptIds) => {
    const skillProfile = setActiveFocusSet(get().skillProfile, conceptIds);
    persistSkillProfile(skillProfile);
    set({ skillProfile });
  },

  recordFocusPractice: (conceptId) => {
    const skillProfile = recordFocusPractice(get().skillProfile, conceptId);
    persistSkillProfile(skillProfile);
    set({ skillProfile });
  },

  graduateConcepts: (conceptIds) => {
    const skillProfile = graduateFocusConcepts(get().skillProfile, conceptIds);
    persistSkillProfile(skillProfile);
    set({ skillProfile });
  },

  processFocusedGrade: (eventId, gradeResult) => {
    const result = processFocusGradeResult(
      get().skillProfile,
      gradeResult,
      get().graded,
    );
    persistSkillProfile(result.profile);
    set({ skillProfile: result.profile });
    return {
      graduated: result.graduated,
      nextFocus: result.nextFocus,
      rationale: result.rationale,
    };
  },

  setLastFocusAssessment: (eventId) => {
    const skillProfile = setLastFocusAssessment(get().skillProfile, eventId);
    persistSkillProfile(skillProfile);
    set({ skillProfile });
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
