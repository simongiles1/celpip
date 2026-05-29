import type { GeminiModel } from "./gemini";
import type { GeminiCostBreakdown } from "./gemini-usage";

export type FocusSubTest =
  | "Writing"
  | "Reading"
  | "Vocabulary"
  | "Mixed"
  | "Review"
  | "Full Mock"
  | "Concept"
  | "EXAM";

export interface VocabularyWord {
  word: string;
  partOfSpeech: string;
  definition: string;
  /** Example sentence suitable for CELPIP email or survey writing. */
  exampleSentence: string;
  /** Brief note on using this word in formal writing. */
  writingTip: string;
  /** Informal or spoken alternative the learner might overuse in writing. */
  spokenAlternative?: string;
}

export type ConceptCategory =
  | "grammar"
  | "vocabulary"
  | "reading_strategy"
  | "writing_structure";

export interface ConceptDefinition {
  id: string;
  label: string;
  category: ConceptCategory;
  description: string;
  examples?: string[];
  source: "seed" | "discovered";
  aliases?: string[];
}

export interface SkillTag {
  conceptId: string;
  label?: string;
  description?: string;
  category?: ConceptCategory;
  polarity: "strength" | "weakness";
  evidence: string;
}

export interface SkillObservation {
  id: string;
  conceptId: string;
  eventId: string;
  track: "subtest" | "concept";
  polarity: "strength" | "weakness";
  evidence: string;
  bandAtTime?: number;
  observedAt: string;
}

export type ConceptTrend = "improving" | "stable" | "declining";

export interface UserConceptScore {
  conceptId: string;
  weaknessCount: number;
  strengthCount: number;
  lastObservedAt: string;
  trend: ConceptTrend;
  mastery: number;
}

export interface UserSkillProfile {
  observations: SkillObservation[];
  conceptScores: UserConceptScore[];
  discoveredConcepts: ConceptDefinition[];
}

export interface ConceptChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  changesSummary?: string;
}

export interface ConceptCustomization {
  conceptId: string;
  instructionMarkdown?: string;
  drillConstraints?: string;
  descriptionOverride?: string;
  chatMessages: ConceptChatMessage[];
  updatedAt: string;
}

export interface ConceptDrillItem {
  prompt: string;
  hint?: string;
}

export interface ConceptDrillResult {
  index: number;
  isCorrect: boolean;
  studentAnswer: string;
  correctAnswer: string;
  feedback: string;
}

export type CelpipReadingPart = "part_1" | "part_2" | "part_3" | "part_4";

export type ReadingQuestionType =
  | "main_idea"
  | "detail_extraction"
  | "inference"
  | "paraphrase_recognition"
  | "vocabulary_in_context"
  | "distractor_analysis"
  | "tone_attitude";

export interface ReadingQuestionResult {
  index: number;
  isCorrect: boolean;
  studentAnswer: string;
  correctAnswer: string;
  feedback: string;
  celpipPart?: CelpipReadingPart;
  questionType?: ReadingQuestionType;
  targetClbBand?: number;
  timeSpentSeconds?: number;
}

export interface ReadingGradeMetadata {
  score: { correct: number; total: number };
  readingResults: ReadingQuestionResult[];
  estimatedBand: number;
  passageCelpipPart?: CelpipReadingPart;
  passageTargetClbBand?: number;
  passageDurationSeconds?: number;
}

export interface ReadingSubmissionEnvelope {
  answers: Record<string, number>;
  gradeMetadata?: ReadingGradeMetadata;
  questionTimings?: Record<string, number>;
  /** Stored for mock attempts so scores can be recomputed after index repair. */
  readingQuestions?: ReadingQuestion[];
  examPrompt?: string;
}

export interface ConceptWritingResult {
  feedback: string;
  isAcceptable: boolean;
}

export interface ConceptContext {
  id: string;
  label: string;
  evidence?: string;
}

export interface CurriculumUnit {
  id: string;
  week: 1 | 2 | 3 | 4;
  dayLabel: string;
  focusSubTest: FocusSubTest;
  focusTarget: string;
  practiceType: string;
  sessionGoal: string;
  grammarFocus?: string;
  strategy?: string;
}

export interface ReadingQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  celpipPart?: CelpipReadingPart;
  questionType?: ReadingQuestionType;
  targetClbBand?: number;
}

export interface StudyEvent {
  id: string;
  curriculumUnitId: string;
  start: string;
  end: string;
  status: "scheduled" | "in_progress" | "completed" | "skipped";
  conceptId?: string;
}

export interface GeneratedContent {
  eventId: string;
  instructions: string;
  example: string;
  examPrompt: string;
  readingQuestions?: ReadingQuestion[];
  /** Saved in-progress answers before a passage is submitted for grading. */
  readingAnswers?: Record<string, number>;
  conceptDrillItems?: ConceptDrillItem[];
  vocabularyWords?: VocabularyWord[];
  conceptId?: string;
  setNumber?: number;
  generatedAt: string;
  geminiUsage?: GeminiCostBreakdown;
  passageCelpipPart?: CelpipReadingPart;
  passageTargetClbBand?: number;
  /** Applied when legacy correctAnswerIndex normalization is repaired in place. */
  readingAnswerIndexRepairVersion?: number;
}

export interface GrammarCorrection {
  original: string;
  corrected: string;
  reason: string;
}

export interface GradedSession {
  eventId: string;
  curriculumUnitId: string;
  focusSubTest: string;
  estimatedBand: number;
  overallFeedback: string;
  positives: string[];
  constructiveCriticism: string[];
  grammarCorrections: GrammarCorrection[];
  studentSubmission:
    | string
    | Record<string, number>
    | ReadingSubmissionEnvelope;
  gradedAt: string;
  geminiUsage?: GeminiCostBreakdown;
  isMock?: boolean;
  mockSpecId?: string;
}

export interface AppSettings {
  examDate: string;
  programStartDate: string;
  defaultSessionDurationMin: number;
}

export interface UserPreferences {
  geminiModel: GeminiModel;
  /** Default CLB band (6-12) used when generating themed reading passages. */
  preferredReadingClbBand?: number;
  /** Words per daily vocabulary calendar session (default 5). */
  dailyVocabularyWordCount?: number;
}

export type SessionMode = "subtest" | "concept" | "review";

export interface GenerateResponse {
  instructions: string;
  example: string;
  examPrompt: string;
  readingQuestions?: ReadingQuestion[];
  conceptDrillItems?: ConceptDrillItem[];
  geminiUsage?: GeminiCostBreakdown;
  passageCelpipPart?: CelpipReadingPart;
  passageTargetClbBand?: number;
}

export interface GradeResponse {
  estimatedBand: number;
  overallFeedback: string;
  positives: string[];
  constructiveCriticism: string[];
  grammarCorrections: GrammarCorrection[];
  skillTags?: SkillTag[];
  drillResults?: ConceptDrillResult[];
  readingResults?: ReadingQuestionResult[];
  writingResult?: ConceptWritingResult;
  geminiUsage?: GeminiCostBreakdown;
}

export type FeedbackTicketType = "bug" | "feature";

export interface FeedbackTicket {
  id: string;
  type: FeedbackTicketType;
  title: string;
  description: string;
  screenshotDataUrls: string[];
  createdAt: string;
}
