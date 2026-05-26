import "server-only";

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { DEFAULT_GEMINI_MODEL, isGeminiModel } from "./gemini";
import { emptySkillProfile } from "./skill-profile";
import type {
  AppSettings,
  ConceptCustomization,
  FeedbackTicket,
  GeneratedContent,
  GradedSession,
  StudyEvent,
  UserPreferences,
  UserSkillProfile,
} from "./types";

export interface AppData {
  settings: AppSettings | null;
  preferences: UserPreferences;
  events: StudyEvent[];
  generated: GeneratedContent[];
  graded: GradedSession[];
  skillProfile: UserSkillProfile;
  conceptCustomizations: ConceptCustomization[];
}

let db: Database.Database | null = null;

function getDatabasePath(): string {
  return (
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "celpip.db")
  );
}

function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDatabasePath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      exam_date TEXT NOT NULL,
      program_start_date TEXT NOT NULL,
      default_session_duration_min INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      gemini_model TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_events (
      id TEXT PRIMARY KEY,
      curriculum_unit_id TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      status TEXT NOT NULL,
      concept_id TEXT
    );

    CREATE TABLE IF NOT EXISTS generated_content (
      event_id TEXT PRIMARY KEY,
      instructions TEXT NOT NULL,
      example TEXT NOT NULL,
      exam_prompt TEXT NOT NULL,
      reading_questions TEXT,
      concept_drill_items TEXT,
      concept_id TEXT,
      generated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS graded_sessions (
      event_id TEXT PRIMARY KEY,
      curriculum_unit_id TEXT NOT NULL,
      focus_sub_test TEXT NOT NULL,
      estimated_band REAL NOT NULL,
      overall_feedback TEXT NOT NULL,
      positives TEXT NOT NULL,
      constructive_criticism TEXT NOT NULL,
      grammar_corrections TEXT NOT NULL,
      student_submission TEXT NOT NULL,
      graded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skill_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS concept_customizations (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_tickets (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('bug', 'feature')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      screenshot_data_url TEXT,
      created_at TEXT NOT NULL
    );
  `);

  migrateGeminiUsageColumns(database);
  migrateFeedbackScreenshotColumns(database);
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function migrateGeminiUsageColumns(database: Database.Database): void {
  const generatedCols = database
    .prepare(`PRAGMA table_info(generated_content)`)
    .all() as Array<{ name: string }>;
  if (!generatedCols.some((c) => c.name === "gemini_usage")) {
    database.exec(
      `ALTER TABLE generated_content ADD COLUMN gemini_usage TEXT`,
    );
  }

  const gradedCols = database
    .prepare(`PRAGMA table_info(graded_sessions)`)
    .all() as Array<{ name: string }>;
  if (!gradedCols.some((c) => c.name === "gemini_usage")) {
    database.exec(`ALTER TABLE graded_sessions ADD COLUMN gemini_usage TEXT`);
  }
}

function migrateFeedbackScreenshotColumns(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(feedback_tickets)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "screenshot_data_urls")) {
    database.exec(
      `ALTER TABLE feedback_tickets ADD COLUMN screenshot_data_urls TEXT`,
    );
    const rows = database
      .prepare(
        `SELECT id, screenshot_data_url
         FROM feedback_tickets
         WHERE screenshot_data_url IS NOT NULL AND screenshot_data_url != ''`,
      )
      .all() as Array<{ id: string; screenshot_data_url: string }>;
    const update = database.prepare(
      `UPDATE feedback_tickets SET screenshot_data_urls = @urls WHERE id = @id`,
    );
    for (const row of rows) {
      update.run({
        id: row.id,
        urls: JSON.stringify([row.screenshot_data_url]),
      });
    }
  }
}

function parseFeedbackScreenshots(
  urlsJson: string | null | undefined,
  legacyUrl: string | null | undefined,
): string[] {
  const parsed = parseJson<string[]>(urlsJson, []);
  if (parsed.length > 0) return parsed;
  if (legacyUrl) return [legacyUrl];
  return [];
}

export function loadSettings(): AppSettings | null {
  const row = getDb()
    .prepare(
      `SELECT exam_date, program_start_date, default_session_duration_min
       FROM app_settings WHERE id = 1`,
    )
    .get() as
    | {
        exam_date: string;
        program_start_date: string;
        default_session_duration_min: number;
      }
    | undefined;

  if (!row) return null;

  return {
    examDate: row.exam_date,
    programStartDate: row.program_start_date,
    defaultSessionDurationMin: row.default_session_duration_min,
  };
}

export function saveSettings(settings: AppSettings): void {
  getDb()
    .prepare(
      `INSERT INTO app_settings (id, exam_date, program_start_date, default_session_duration_min)
       VALUES (1, @examDate, @programStartDate, @defaultSessionDurationMin)
       ON CONFLICT(id) DO UPDATE SET
         exam_date = excluded.exam_date,
         program_start_date = excluded.program_start_date,
         default_session_duration_min = excluded.default_session_duration_min`,
    )
    .run({
      examDate: settings.examDate,
      programStartDate: settings.programStartDate,
      defaultSessionDurationMin: settings.defaultSessionDurationMin,
    });
}

export function loadPreferences(): UserPreferences {
  const row = getDb()
    .prepare(`SELECT gemini_model FROM user_preferences WHERE id = 1`)
    .get() as { gemini_model: string } | undefined;

  if (!row) {
    return { geminiModel: DEFAULT_GEMINI_MODEL };
  }

  return {
    geminiModel: isGeminiModel(row.gemini_model)
      ? row.gemini_model
      : DEFAULT_GEMINI_MODEL,
  };
}

export function savePreferences(preferences: UserPreferences): void {
  getDb()
    .prepare(
      `INSERT INTO user_preferences (id, gemini_model)
       VALUES (1, @geminiModel)
       ON CONFLICT(id) DO UPDATE SET gemini_model = excluded.gemini_model`,
    )
    .run({ geminiModel: preferences.geminiModel });
}

export function loadEvents(): StudyEvent[] {
  const rows = getDb()
    .prepare(
      `SELECT id, curriculum_unit_id, start_at, end_at, status, concept_id
       FROM study_events ORDER BY start_at`,
    )
    .all() as Array<{
    id: string;
    curriculum_unit_id: string;
    start_at: string;
    end_at: string;
    status: StudyEvent["status"];
    concept_id: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    curriculumUnitId: row.curriculum_unit_id,
    start: row.start_at,
    end: row.end_at,
    status: row.status,
    ...(row.concept_id ? { conceptId: row.concept_id } : {}),
  }));
}

export function saveEvents(events: StudyEvent[]): void {
  const database = getDb();
  const replaceAll = database.transaction((items: StudyEvent[]) => {
    database.prepare(`DELETE FROM study_events`).run();
    const insert = database.prepare(
      `INSERT INTO study_events (id, curriculum_unit_id, start_at, end_at, status, concept_id)
       VALUES (@id, @curriculumUnitId, @start, @end, @status, @conceptId)`,
    );
    for (const event of items) {
      insert.run({
        id: event.id,
        curriculumUnitId: event.curriculumUnitId,
        start: event.start,
        end: event.end,
        status: event.status,
        conceptId: event.conceptId ?? null,
      });
    }
  });
  replaceAll(events);
}

export function loadGenerated(): GeneratedContent[] {
  const rows = getDb()
    .prepare(
      `SELECT event_id, instructions, example, exam_prompt, reading_questions,
              concept_drill_items, concept_id, generated_at, gemini_usage
       FROM generated_content ORDER BY generated_at`,
    )
    .all() as Array<{
    event_id: string;
    instructions: string;
    example: string;
    exam_prompt: string;
    reading_questions: string | null;
    concept_drill_items: string | null;
    concept_id: string | null;
    generated_at: string;
    gemini_usage: string | null;
  }>;

  return rows.map((row) => ({
    eventId: row.event_id,
    instructions: row.instructions,
    example: row.example,
    examPrompt: row.exam_prompt,
    readingQuestions: parseJson(row.reading_questions, undefined),
    conceptDrillItems: parseJson(row.concept_drill_items, undefined),
    ...(row.concept_id ? { conceptId: row.concept_id } : {}),
    generatedAt: row.generated_at,
    geminiUsage: parseJson(row.gemini_usage, undefined),
  }));
}

export function saveGenerated(items: GeneratedContent[]): void {
  const database = getDb();
  const replaceAll = database.transaction((records: GeneratedContent[]) => {
    database.prepare(`DELETE FROM generated_content`).run();
    const insert = database.prepare(
      `INSERT INTO generated_content (
         event_id, instructions, example, exam_prompt, reading_questions,
         concept_drill_items, concept_id, generated_at, gemini_usage
       ) VALUES (
         @eventId, @instructions, @example, @examPrompt, @readingQuestions,
         @conceptDrillItems, @conceptId, @generatedAt, @geminiUsage
       )`,
    );
    for (const item of records) {
      insert.run({
        eventId: item.eventId,
        instructions: item.instructions,
        example: item.example,
        examPrompt: item.examPrompt,
        readingQuestions: item.readingQuestions
          ? JSON.stringify(item.readingQuestions)
          : null,
        conceptDrillItems: item.conceptDrillItems
          ? JSON.stringify(item.conceptDrillItems)
          : null,
        conceptId: item.conceptId ?? null,
        generatedAt: item.generatedAt,
        geminiUsage: item.geminiUsage
          ? JSON.stringify(item.geminiUsage)
          : null,
      });
    }
  });
  replaceAll(items);
}

export function loadGraded(): GradedSession[] {
  const rows = getDb()
    .prepare(
      `SELECT event_id, curriculum_unit_id, focus_sub_test, estimated_band,
              overall_feedback, positives, constructive_criticism,
              grammar_corrections, student_submission, graded_at, gemini_usage
       FROM graded_sessions ORDER BY graded_at`,
    )
    .all() as Array<{
    event_id: string;
    curriculum_unit_id: string;
    focus_sub_test: string;
    estimated_band: number;
    overall_feedback: string;
    positives: string;
    constructive_criticism: string;
    grammar_corrections: string;
    student_submission: string;
    graded_at: string;
    gemini_usage: string | null;
  }>;

  return rows.map((row) => ({
    eventId: row.event_id,
    curriculumUnitId: row.curriculum_unit_id,
    focusSubTest: row.focus_sub_test,
    estimatedBand: row.estimated_band,
    overallFeedback: row.overall_feedback,
    positives: parseJson<string[]>(row.positives, []),
    constructiveCriticism: parseJson<string[]>(row.constructive_criticism, []),
    grammarCorrections: parseJson(row.grammar_corrections, []),
    studentSubmission: parseJson<string | Record<string, number>>(
      row.student_submission,
      "",
    ),
    gradedAt: row.graded_at,
    geminiUsage: parseJson(row.gemini_usage, undefined),
  }));
}

export function saveGraded(items: GradedSession[]): void {
  const database = getDb();
  const replaceAll = database.transaction((records: GradedSession[]) => {
    database.prepare(`DELETE FROM graded_sessions`).run();
    const insert = database.prepare(
      `INSERT INTO graded_sessions (
         event_id, curriculum_unit_id, focus_sub_test, estimated_band,
         overall_feedback, positives, constructive_criticism,
         grammar_corrections, student_submission, graded_at, gemini_usage
       ) VALUES (
         @eventId, @curriculumUnitId, @focusSubTest, @estimatedBand,
         @overallFeedback, @positives, @constructiveCriticism,
         @grammarCorrections, @studentSubmission, @gradedAt, @geminiUsage
       )`,
    );
    for (const item of records) {
      insert.run({
        eventId: item.eventId,
        curriculumUnitId: item.curriculumUnitId,
        focusSubTest: item.focusSubTest,
        estimatedBand: item.estimatedBand,
        overallFeedback: item.overallFeedback,
        positives: JSON.stringify(item.positives),
        constructiveCriticism: JSON.stringify(item.constructiveCriticism),
        grammarCorrections: JSON.stringify(item.grammarCorrections),
        studentSubmission: JSON.stringify(item.studentSubmission),
        gradedAt: item.gradedAt,
        geminiUsage: item.geminiUsage
          ? JSON.stringify(item.geminiUsage)
          : null,
      });
    }
  });
  replaceAll(items);
}

export function loadSkillProfile(): UserSkillProfile {
  const row = getDb()
    .prepare(`SELECT data FROM skill_profile WHERE id = 1`)
    .get() as { data: string } | undefined;

  if (!row) return emptySkillProfile();
  return parseJson(row.data, emptySkillProfile());
}

export function saveSkillProfile(profile: UserSkillProfile): void {
  getDb()
    .prepare(
      `INSERT INTO skill_profile (id, data)
       VALUES (1, @data)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    )
    .run({ data: JSON.stringify(profile) });
}

export function loadConceptCustomizations(): ConceptCustomization[] {
  const row = getDb()
    .prepare(`SELECT data FROM concept_customizations WHERE id = 1`)
    .get() as { data: string } | undefined;

  if (!row) return [];
  return parseJson(row.data, [] as ConceptCustomization[]);
}

export function saveConceptCustomizations(
  items: ConceptCustomization[],
): void {
  getDb()
    .prepare(
      `INSERT INTO concept_customizations (id, data)
       VALUES (1, @data)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    )
    .run({ data: JSON.stringify(items) });
}

export function loadFeedbackTickets(): FeedbackTicket[] {
  const rows = getDb()
    .prepare(
      `SELECT id, type, title, description, screenshot_data_url,
              screenshot_data_urls, created_at
       FROM feedback_tickets ORDER BY created_at DESC`,
    )
    .all() as Array<{
    id: string;
    type: FeedbackTicket["type"];
    title: string;
    description: string;
    screenshot_data_url: string | null;
    screenshot_data_urls: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    screenshotDataUrls: parseFeedbackScreenshots(
      row.screenshot_data_urls,
      row.screenshot_data_url,
    ),
    createdAt: row.created_at,
  }));
}

export function insertFeedbackTicket(
  ticket: Omit<FeedbackTicket, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): FeedbackTicket {
  const record: FeedbackTicket = {
    id: ticket.id ?? `feedback-${Date.now()}`,
    type: ticket.type,
    title: ticket.title,
    description: ticket.description,
    screenshotDataUrls: ticket.screenshotDataUrls,
    createdAt: ticket.createdAt ?? new Date().toISOString(),
  };

  getDb()
    .prepare(
      `INSERT INTO feedback_tickets (
         id, type, title, description, screenshot_data_url, screenshot_data_urls,
         created_at
       ) VALUES (
         @id, @type, @title, @description, @legacyScreenshot, @screenshotDataUrls,
         @createdAt
       )`,
    )
    .run({
      id: record.id,
      type: record.type,
      title: record.title,
      description: record.description,
      legacyScreenshot: record.screenshotDataUrls[0] ?? null,
      screenshotDataUrls: JSON.stringify(record.screenshotDataUrls),
      createdAt: record.createdAt,
    });

  return record;
}

export function loadAllData(): AppData {
  return {
    settings: loadSettings(),
    preferences: loadPreferences(),
    events: loadEvents(),
    generated: loadGenerated(),
    graded: loadGraded(),
    skillProfile: loadSkillProfile(),
    conceptCustomizations: loadConceptCustomizations(),
  };
}

export type PartialAppData = {
  settings?: AppSettings | null;
  preferences?: UserPreferences;
  events?: StudyEvent[];
  generated?: GeneratedContent[];
  graded?: GradedSession[];
  skillProfile?: UserSkillProfile;
  conceptCustomizations?: ConceptCustomization[];
};

export function savePartialData(data: PartialAppData): void {
  if (data.settings !== undefined) {
    if (data.settings === null) {
      getDb().prepare(`DELETE FROM app_settings WHERE id = 1`).run();
    } else {
      saveSettings(data.settings);
    }
  }
  if (data.preferences !== undefined) {
    savePreferences(data.preferences);
  }
  if (data.events !== undefined) {
    saveEvents(data.events);
  }
  if (data.generated !== undefined) {
    saveGenerated(data.generated);
  }
  if (data.graded !== undefined) {
    saveGraded(data.graded);
  }
  if (data.skillProfile !== undefined) {
    saveSkillProfile(data.skillProfile);
  }
  if (data.conceptCustomizations !== undefined) {
    saveConceptCustomizations(data.conceptCustomizations);
  }
}

export function exportAllData(): string {
  return JSON.stringify(
    {
      ...loadAllData(),
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json) as PartialAppData & {
      settings?: AppSettings;
    };
    if (data.settings) saveSettings(data.settings);
    if (data.preferences) savePreferences(data.preferences);
    if (data.events) saveEvents(data.events);
    if (data.generated) saveGenerated(data.generated);
    if (data.graded) saveGraded(data.graded);
    if (data.skillProfile) saveSkillProfile(data.skillProfile);
    if (data.conceptCustomizations) {
      saveConceptCustomizations(data.conceptCustomizations);
    }
    return true;
  } catch {
    return false;
  }
}

export function clearAllData(): void {
  const database = getDb();
  database.exec(`
    DELETE FROM app_settings;
    DELETE FROM user_preferences;
    DELETE FROM study_events;
    DELETE FROM generated_content;
    DELETE FROM graded_sessions;
    DELETE FROM skill_profile;
    DELETE FROM concept_customizations;
    DELETE FROM feedback_tickets;
  `);
}
