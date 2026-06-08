import "server-only";

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { DEFAULT_GEMINI_MODEL, isGeminiModel } from "./gemini";
import { emptySkillProfile } from "./skill-profile";
import { migrateReadingAnswerIndices } from "./repair-reading-answer-indices";
import { ensureVocabularyEvents } from "./schedule";
import type {
  AppSettings,
  ConceptCustomization,
  FeedbackTicket,
  FeedbackTicketMessage,
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
      gemini_model TEXT NOT NULL,
      preferred_reading_clb_band INTEGER
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
      generated_at TEXT NOT NULL,
      passage_celpip_part TEXT,
      passage_target_clb_band INTEGER
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
      graded_at TEXT NOT NULL,
      is_mock INTEGER NOT NULL DEFAULT 0,
      mock_spec_id TEXT
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

    CREATE TABLE IF NOT EXISTS feedback_ticket_messages (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES feedback_tickets(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_ticket_messages_ticket_id
      ON feedback_ticket_messages(ticket_id);
  `);

  migrateGeminiUsageColumns(database);
  migrateFeedbackScreenshotColumns(database);
  migrateReadingAnswersColumn(database);
  migrateReadingClbColumns(database);
  migrateMockColumns(database);
  migratePreferredReadingClbColumn(database);
  migrateDailyVocabularyWordCountColumn(database);
  migrateVocabularyWordsColumn(database);
  migrateVocabularyProgressColumn(database);
  migrateFeedbackTicketStatusColumn(database);
  migrateFeedbackTicketMessagesTable(database);
}

function migrateFeedbackTicketMessagesTable(database: Database.Database): void {
  const tables = database
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'feedback_ticket_messages'`,
    )
    .all() as Array<{ name: string }>;
  if (tables.length > 0) return;

  database.exec(`
    CREATE TABLE feedback_ticket_messages (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES feedback_tickets(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX idx_feedback_ticket_messages_ticket_id
      ON feedback_ticket_messages(ticket_id);
  `);
}

function migrateFeedbackTicketStatusColumn(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(feedback_tickets)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "status")) {
    database.exec(
      `ALTER TABLE feedback_tickets ADD COLUMN status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))`,
    );
  }
}

function migrateReadingClbColumns(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(generated_content)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "passage_celpip_part")) {
    database.exec(
      `ALTER TABLE generated_content ADD COLUMN passage_celpip_part TEXT`,
    );
  }
  if (!cols.some((c) => c.name === "passage_target_clb_band")) {
    database.exec(
      `ALTER TABLE generated_content ADD COLUMN passage_target_clb_band INTEGER`,
    );
  }
}

function migrateMockColumns(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(graded_sessions)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "is_mock")) {
    database.exec(
      `ALTER TABLE graded_sessions ADD COLUMN is_mock INTEGER NOT NULL DEFAULT 0`,
    );
  }
  if (!cols.some((c) => c.name === "mock_spec_id")) {
    database.exec(
      `ALTER TABLE graded_sessions ADD COLUMN mock_spec_id TEXT`,
    );
  }
}

function migratePreferredReadingClbColumn(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(user_preferences)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "preferred_reading_clb_band")) {
    database.exec(
      `ALTER TABLE user_preferences ADD COLUMN preferred_reading_clb_band INTEGER`,
    );
  }
}

function migrateDailyVocabularyWordCountColumn(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(user_preferences)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "daily_vocabulary_word_count")) {
    database.exec(
      `ALTER TABLE user_preferences ADD COLUMN daily_vocabulary_word_count INTEGER`,
    );
  }
}

function migrateVocabularyWordsColumn(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(generated_content)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "vocabulary_words")) {
    database.exec(
      `ALTER TABLE generated_content ADD COLUMN vocabulary_words TEXT`,
    );
  }
}

function migrateVocabularyProgressColumn(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(generated_content)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "vocabulary_progress")) {
    database.exec(
      `ALTER TABLE generated_content ADD COLUMN vocabulary_progress TEXT`,
    );
  }
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

function migrateReadingAnswersColumn(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(generated_content)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "reading_answers")) {
    database.exec(
      `ALTER TABLE generated_content ADD COLUMN reading_answers TEXT`,
    );
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

function clampClbBand(value: number | null | undefined): number | undefined {
  if (value == null) return undefined;
  if (!Number.isFinite(value)) return undefined;
  return Math.max(6, Math.min(12, Math.round(value)));
}

function clampVocabularyWordCount(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(20, Math.round(value)));
}

export function loadPreferences(): UserPreferences {
  const row = getDb()
    .prepare(
      `SELECT gemini_model, preferred_reading_clb_band, daily_vocabulary_word_count
       FROM user_preferences WHERE id = 1`,
    )
    .get() as
    | {
        gemini_model: string;
        preferred_reading_clb_band: number | null;
        daily_vocabulary_word_count: number | null;
      }
    | undefined;

  if (!row) {
    return {
      geminiModel: DEFAULT_GEMINI_MODEL,
      preferredReadingClbBand: 9,
      dailyVocabularyWordCount: 5,
    };
  }

  return {
    geminiModel: isGeminiModel(row.gemini_model)
      ? row.gemini_model
      : DEFAULT_GEMINI_MODEL,
    preferredReadingClbBand:
      clampClbBand(row.preferred_reading_clb_band) ?? 9,
    dailyVocabularyWordCount: clampVocabularyWordCount(
      row.daily_vocabulary_word_count,
    ),
  };
}

export function savePreferences(preferences: UserPreferences): void {
  getDb()
    .prepare(
      `INSERT INTO user_preferences (id, gemini_model, preferred_reading_clb_band, daily_vocabulary_word_count)
       VALUES (1, @geminiModel, @preferredReadingClbBand, @dailyVocabularyWordCount)
       ON CONFLICT(id) DO UPDATE SET
         gemini_model = excluded.gemini_model,
         preferred_reading_clb_band = excluded.preferred_reading_clb_band,
         daily_vocabulary_word_count = excluded.daily_vocabulary_word_count`,
    )
    .run({
      geminiModel: preferences.geminiModel,
      preferredReadingClbBand:
        clampClbBand(preferences.preferredReadingClbBand) ?? null,
      dailyVocabularyWordCount: clampVocabularyWordCount(
        preferences.dailyVocabularyWordCount,
      ),
    });
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
  const settings = loadSettings();
  const merged = settings
    ? ensureVocabularyEvents(events, settings).events
    : events;

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
  replaceAll(merged);
}

export function loadGenerated(): GeneratedContent[] {
  const rows = getDb()
    .prepare(
      `SELECT event_id, instructions, example, exam_prompt, reading_questions,
              reading_answers, concept_drill_items, vocabulary_words, vocabulary_progress,
              concept_id, generated_at, gemini_usage,
              passage_celpip_part, passage_target_clb_band
       FROM generated_content ORDER BY generated_at`,
    )
    .all() as Array<{
    event_id: string;
    instructions: string;
    example: string;
    exam_prompt: string;
    reading_questions: string | null;
    reading_answers: string | null;
    concept_drill_items: string | null;
    vocabulary_words: string | null;
    vocabulary_progress: string | null;
    concept_id: string | null;
    generated_at: string;
    gemini_usage: string | null;
    passage_celpip_part: string | null;
    passage_target_clb_band: number | null;
  }>;

  return rows.map((row) => ({
    eventId: row.event_id,
    instructions: row.instructions,
    example: row.example,
    examPrompt: row.exam_prompt,
    readingQuestions: parseJson(row.reading_questions, undefined),
    readingAnswers: parseJson<Record<string, number> | undefined>(
      row.reading_answers,
      undefined,
    ),
    conceptDrillItems: parseJson(row.concept_drill_items, undefined),
    vocabularyWords: parseJson(row.vocabulary_words, undefined),
    vocabularyProgress: parseJson(row.vocabulary_progress, undefined),
    ...(row.concept_id ? { conceptId: row.concept_id } : {}),
    generatedAt: row.generated_at,
    geminiUsage: parseJson(row.gemini_usage, undefined),
    ...(row.passage_celpip_part
      ? {
          passageCelpipPart:
            row.passage_celpip_part as GeneratedContent["passageCelpipPart"],
        }
      : {}),
    ...(clampClbBand(row.passage_target_clb_band) != null
      ? { passageTargetClbBand: clampClbBand(row.passage_target_clb_band) }
      : {}),
  }));
}

export function saveGenerated(items: GeneratedContent[]): void {
  const database = getDb();
  const replaceAll = database.transaction((records: GeneratedContent[]) => {
    database.prepare(`DELETE FROM generated_content`).run();
    const insert = database.prepare(
      `INSERT INTO generated_content (
         event_id, instructions, example, exam_prompt, reading_questions,
         reading_answers, concept_drill_items, vocabulary_words, vocabulary_progress,
         concept_id, generated_at, gemini_usage,
         passage_celpip_part, passage_target_clb_band
       ) VALUES (
         @eventId, @instructions, @example, @examPrompt, @readingQuestions,
         @readingAnswers, @conceptDrillItems, @vocabularyWords, @vocabularyProgress,
         @conceptId, @generatedAt, @geminiUsage,
         @passageCelpipPart, @passageTargetClbBand
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
        readingAnswers: item.readingAnswers
          ? JSON.stringify(item.readingAnswers)
          : null,
        conceptDrillItems: item.conceptDrillItems
          ? JSON.stringify(item.conceptDrillItems)
          : null,
        vocabularyWords: item.vocabularyWords
          ? JSON.stringify(item.vocabularyWords)
          : null,
        vocabularyProgress: item.vocabularyProgress
          ? JSON.stringify(item.vocabularyProgress)
          : null,
        conceptId: item.conceptId ?? null,
        generatedAt: item.generatedAt,
        geminiUsage: item.geminiUsage
          ? JSON.stringify(item.geminiUsage)
          : null,
        passageCelpipPart: item.passageCelpipPart ?? null,
        passageTargetClbBand: clampClbBand(item.passageTargetClbBand) ?? null,
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
              grammar_corrections, student_submission, graded_at, gemini_usage,
              is_mock, mock_spec_id
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
    is_mock: number | null;
    mock_spec_id: string | null;
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
    studentSubmission: parseJson<
      GradedSession["studentSubmission"]
    >(row.student_submission, ""),
    gradedAt: row.graded_at,
    geminiUsage: parseJson(row.gemini_usage, undefined),
    ...(row.is_mock ? { isMock: true } : {}),
    ...(row.mock_spec_id ? { mockSpecId: row.mock_spec_id } : {}),
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
         grammar_corrections, student_submission, graded_at, gemini_usage,
         is_mock, mock_spec_id
       ) VALUES (
         @eventId, @curriculumUnitId, @focusSubTest, @estimatedBand,
         @overallFeedback, @positives, @constructiveCriticism,
         @grammarCorrections, @studentSubmission, @gradedAt, @geminiUsage,
         @isMock, @mockSpecId
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
        isMock: item.isMock ? 1 : 0,
        mockSpecId: item.mockSpecId ?? null,
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

function loadFeedbackTicketMessagesByTicketId(): Map<string, FeedbackTicketMessage[]> {
  const rows = getDb()
    .prepare(
      `SELECT id, ticket_id, body, created_at
       FROM feedback_ticket_messages
       ORDER BY created_at ASC`,
    )
    .all() as Array<{
    id: string;
    ticket_id: string;
    body: string;
    created_at: string;
  }>;

  const messagesByTicketId = new Map<string, FeedbackTicketMessage[]>();
  for (const row of rows) {
    const message: FeedbackTicketMessage = {
      id: row.id,
      ticketId: row.ticket_id,
      body: row.body,
      createdAt: row.created_at,
    };
    const existing = messagesByTicketId.get(row.ticket_id) ?? [];
    existing.push(message);
    messagesByTicketId.set(row.ticket_id, existing);
  }
  return messagesByTicketId;
}

export function loadFeedbackTickets(): FeedbackTicket[] {
  const messagesByTicketId = loadFeedbackTicketMessagesByTicketId();
  const rows = getDb()
    .prepare(
      `SELECT id, type, status, title, description, screenshot_data_url,
              screenshot_data_urls, created_at
       FROM feedback_tickets ORDER BY created_at DESC`,
    )
    .all() as Array<{
    id: string;
    type: FeedbackTicket["type"];
    status: FeedbackTicket["status"] | null;
    title: string;
    description: string;
    screenshot_data_url: string | null;
    screenshot_data_urls: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status ?? "open",
    title: row.title,
    description: row.description,
    screenshotDataUrls: parseFeedbackScreenshots(
      row.screenshot_data_urls,
      row.screenshot_data_url,
    ),
    createdAt: row.created_at,
    messages: messagesByTicketId.get(row.id) ?? [],
  }));
}

export function insertFeedbackTicket(
  ticket: Omit<FeedbackTicket, "id" | "createdAt" | "status" | "messages"> & {
    id?: string;
    createdAt?: string;
    status?: FeedbackTicket["status"];
  },
): FeedbackTicket {
  const record: FeedbackTicket = {
    id: ticket.id ?? `feedback-${Date.now()}`,
    type: ticket.type,
    status: ticket.status ?? "open",
    title: ticket.title,
    description: ticket.description,
    screenshotDataUrls: ticket.screenshotDataUrls,
    createdAt: ticket.createdAt ?? new Date().toISOString(),
    messages: [],
  };

  getDb()
    .prepare(
      `INSERT INTO feedback_tickets (
         id, type, status, title, description, screenshot_data_url, screenshot_data_urls,
         created_at
       ) VALUES (
         @id, @type, @status, @title, @description, @legacyScreenshot, @screenshotDataUrls,
         @createdAt
       )`,
    )
    .run({
      id: record.id,
      type: record.type,
      status: record.status,
      title: record.title,
      description: record.description,
      legacyScreenshot: record.screenshotDataUrls[0] ?? null,
      screenshotDataUrls: JSON.stringify(record.screenshotDataUrls),
      createdAt: record.createdAt,
    });

  return record;
}

export function updateFeedbackTicketStatus(
  id: string,
  status: FeedbackTicket["status"],
): FeedbackTicket | null {
  const existing = getDb()
    .prepare(`SELECT id FROM feedback_tickets WHERE id = @id`)
    .get({ id }) as { id: string } | undefined;
  if (!existing) return null;

  getDb()
    .prepare(`UPDATE feedback_tickets SET status = @status WHERE id = @id`)
    .run({ id, status });

  return loadFeedbackTickets().find((ticket) => ticket.id === id) ?? null;
}

export function insertFeedbackTicketMessage(
  ticketId: string,
  body: string,
): FeedbackTicketMessage | null {
  const existing = getDb()
    .prepare(`SELECT id FROM feedback_tickets WHERE id = @id`)
    .get({ id: ticketId }) as { id: string } | undefined;
  if (!existing) return null;

  const record: FeedbackTicketMessage = {
    id: `feedback-msg-${Date.now()}`,
    ticketId,
    body,
    createdAt: new Date().toISOString(),
  };

  getDb()
    .prepare(
      `INSERT INTO feedback_ticket_messages (id, ticket_id, body, created_at)
       VALUES (@id, @ticketId, @body, @createdAt)`,
    )
    .run(record);

  return record;
}

export function deleteFeedbackTicket(id: string): boolean {
  const result = getDb()
    .prepare(`DELETE FROM feedback_tickets WHERE id = @id`)
    .run({ id });
  return result.changes > 0;
}

export function loadAllData(): AppData {
  const raw = {
    settings: loadSettings(),
    preferences: loadPreferences(),
    events: loadEvents(),
    generated: loadGenerated(),
    graded: loadGraded(),
    skillProfile: loadSkillProfile(),
    conceptCustomizations: loadConceptCustomizations(),
  };

  const migrated = migrateReadingAnswerIndices({
    generated: raw.generated,
    graded: raw.graded,
  });

  if (migrated.changed) {
    saveGenerated(migrated.generated);
    saveGraded(migrated.graded);
  }

  let events = raw.events;
  if (raw.settings) {
    const vocabResult = ensureVocabularyEvents(events, raw.settings);
    if (vocabResult.changed) {
      events = vocabResult.events;
      saveEvents(events);
    }
  }

  return {
    ...raw,
    events,
    generated: migrated.generated,
    graded: migrated.graded,
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
    DELETE FROM feedback_ticket_messages;
    DELETE FROM feedback_tickets;
  `);
}
