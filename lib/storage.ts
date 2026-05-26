import { DEFAULT_GEMINI_MODEL, isGeminiModel } from "./gemini";
import { emptySkillProfile } from "./skill-profile";
import type {
  AppSettings,
  ConceptCustomization,
  GeneratedContent,
  GradedSession,
  StudyEvent,
  UserPreferences,
  UserSkillProfile,
} from "./types";

/** Legacy keys — used only for one-time migration from localStorage. */
export const STORAGE_KEYS = {
  settings: "celpip_settings",
  events: "celpip_events",
  generated: "celpip_generated",
  graded: "celpip_graded",
  preferences: "celpip_preferences",
  skillProfile: "celpip_skill_profile",
  conceptCustomizations: "celpip_concept_customizations",
} as const;

export interface LoadedAppData {
  settings: AppSettings | null;
  preferences: UserPreferences;
  events: StudyEvent[];
  generated: GeneratedContent[];
  graded: GradedSession[];
  skillProfile: UserSkillProfile;
  conceptCustomizations: ConceptCustomization[];
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

async function apiRequest<T>(
  method: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/data", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

function readLegacySettings(): AppSettings | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(STORAGE_KEYS.settings);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppSettings;
  } catch {
    return null;
  }
}

function readLegacyPreferences(): UserPreferences {
  if (!isBrowser()) {
    return { geminiModel: DEFAULT_GEMINI_MODEL };
  }
  const raw = localStorage.getItem(STORAGE_KEYS.preferences);
  if (!raw) {
    return { geminiModel: DEFAULT_GEMINI_MODEL };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      geminiModel: isGeminiModel(parsed.geminiModel)
        ? parsed.geminiModel
        : DEFAULT_GEMINI_MODEL,
    };
  } catch {
    return { geminiModel: DEFAULT_GEMINI_MODEL };
  }
}

function readLegacyEvents(): StudyEvent[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(STORAGE_KEYS.events);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StudyEvent[];
  } catch {
    return [];
  }
}

function readLegacyGenerated(): GeneratedContent[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(STORAGE_KEYS.generated);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as GeneratedContent[];
  } catch {
    return [];
  }
}

function readLegacyGraded(): GradedSession[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(STORAGE_KEYS.graded);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as GradedSession[];
  } catch {
    return [];
  }
}

function readLegacySkillProfile(): UserSkillProfile {
  if (!isBrowser()) return emptySkillProfile();
  const raw = localStorage.getItem(STORAGE_KEYS.skillProfile);
  if (!raw) return emptySkillProfile();
  try {
    return JSON.parse(raw) as UserSkillProfile;
  } catch {
    return emptySkillProfile();
  }
}

function hasLegacyLocalStorageData(): boolean {
  if (!isBrowser()) return false;
  return Object.values(STORAGE_KEYS).some((key) => localStorage.getItem(key));
}

function clearLegacyLocalStorage(): void {
  if (!isBrowser()) return;
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

async function migrateLegacyLocalStorageIfNeeded(
  current: LoadedAppData,
): Promise<LoadedAppData> {
  if (!hasLegacyLocalStorageData()) {
    return current;
  }

  const legacy: LoadedAppData = {
    settings: readLegacySettings(),
    preferences: readLegacyPreferences(),
    events: readLegacyEvents(),
    generated: readLegacyGenerated(),
    graded: readLegacyGraded(),
    skillProfile: readLegacySkillProfile(),
    conceptCustomizations: [],
  };

  const merged: LoadedAppData = {
    settings: current.settings ?? legacy.settings,
    preferences: current.preferences.geminiModel === DEFAULT_GEMINI_MODEL
      ? legacy.preferences
      : current.preferences,
    events: current.events.length > 0 ? current.events : legacy.events,
    generated: current.generated.length > 0 ? current.generated : legacy.generated,
    graded: current.graded.length > 0 ? current.graded : legacy.graded,
    skillProfile:
      current.skillProfile.observations.length > 0 ||
      current.skillProfile.conceptScores.length > 0 ||
      current.skillProfile.discoveredConcepts.length > 0
        ? current.skillProfile
        : legacy.skillProfile,
    conceptCustomizations: current.conceptCustomizations ?? [],
  };

  await apiRequest("POST", { action: "migrate", ...merged });
  clearLegacyLocalStorage();
  return merged;
}

export async function loadAllData(): Promise<LoadedAppData> {
  const data = await apiRequest<LoadedAppData>("GET");
  return migrateLegacyLocalStorageIfNeeded(data);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await apiRequest("PUT", { settings });
}

export async function savePreferences(
  preferences: UserPreferences,
): Promise<void> {
  await apiRequest("PUT", { preferences });
}

export async function saveEvents(events: StudyEvent[]): Promise<void> {
  await apiRequest("PUT", { events });
}

export async function saveGenerated(items: GeneratedContent[]): Promise<void> {
  await apiRequest("PUT", { generated: items });
}

export async function saveGraded(items: GradedSession[]): Promise<void> {
  await apiRequest("PUT", { graded: items });
}

export async function saveSkillProfile(
  profile: UserSkillProfile,
): Promise<void> {
  await apiRequest("PUT", { skillProfile: profile });
}

export async function saveConceptCustomizations(
  items: ConceptCustomization[],
): Promise<void> {
  await apiRequest("PUT", { conceptCustomizations: items });
}

export async function exportAllData(): Promise<string> {
  const response = await fetch("/api/data?export=1");
  if (!response.ok) {
    throw new Error("Failed to export data");
  }
  return response.text();
}

export async function importAllData(json: string): Promise<boolean> {
  try {
    const data = JSON.parse(json) as LoadedAppData & { settings?: AppSettings };
    await apiRequest("POST", { action: "import", ...data });
    return true;
  } catch {
    return false;
  }
}

export async function clearAllData(): Promise<void> {
  await apiRequest("DELETE");
}

function persist(promise: Promise<void>): void {
  void promise.catch((error) => {
    console.error("Failed to persist study data:", error);
  });
}

/** Fire-and-forget wrappers used by the Zustand store. */
export function persistSettings(settings: AppSettings): void {
  persist(saveSettings(settings));
}

export function persistPreferences(preferences: UserPreferences): void {
  persist(savePreferences(preferences));
}

export function persistEvents(events: StudyEvent[]): void {
  persist(saveEvents(events));
}

export function persistGenerated(items: GeneratedContent[]): void {
  persist(saveGenerated(items));
}

export function persistGraded(items: GradedSession[]): void {
  persist(saveGraded(items));
}

export function persistSkillProfile(profile: UserSkillProfile): void {
  persist(saveSkillProfile(profile));
}

export function persistConceptCustomizations(
  items: ConceptCustomization[],
): void {
  persist(saveConceptCustomizations(items));
}

export async function saveAllData(data: Partial<LoadedAppData>): Promise<void> {
  await apiRequest("PUT", data);
}

export function persistAll(data: Partial<LoadedAppData>): void {
  persist(saveAllData(data));
}
