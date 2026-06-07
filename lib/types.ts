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

export type VocabularyQuestionType =
  | "definition_choice"
  | "word_fit_select"
  | "synonym_choice";

export interface VocabularyQuestion {
  type: VocabularyQuestionType;
  prompt: string;
  /** Options for single- or multi-select questions. */
  options?: string[];
  /** Correct option index for definition_choice and synonym_choice. */
  correctAnswerIndex?: number;
  /** Correct option indexes for word_fit_select (check all that apply). */
  correctAnswerIndexes?: number[];
  /** Short explanation shown after the learner answers. */
  explanation?: string;
}

export interface VocabularyQuestionAnswerState {
  selectedIndex?: number;
  selectedIndexes?: number[];
  checked: boolean;
  isCorrect?: boolean;
}

export interface VocabularyProgress {
  currentWordIndex: number;
  answersByWord: Record<string, VocabularyQuestionAnswerState[]>;
}

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
  /** Practice questions for this word (definition, word-fit, synonyms). */
  questions?: VocabularyQuestion[];
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

export type SkillObservationTrack = "subtest" | "concept" | "focus";

export interface SkillObservation {
  id: string;
  conceptId: string;
  eventId: string;
  track: SkillObservationTrack;
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

export interface FocusConceptBaseline {
  mastery: number;
  instanceCount: number;
}

export interface FocusHistoryEntry {
  conceptIds: string[];
  startedAt: string;
  graduatedAt?: string;
  rationale?: string;
}

export interface FocusSelectionRationale {
  conceptId: string;
  score: number;
  rationale: string;
  estimatedScoreImpact: number;
  estimatedEffort: number;
}

export interface FocusModelState {
  activeFocus: string[];
  focusHistory: FocusHistoryEntry[];
  practiceCompleted: Record<string, number>;
  lastAssessmentEventId?: string;
  baselineByConcept: Record<string, FocusConceptBaseline>;
  lastSelectionRationale?: FocusSelectionRationale[];
}

export interface FocusHighlight {
  text: string;
  conceptId: string;
  polarity: "correct" | "mistake";
  note: string;
}

export interface FocusRankEntry {
  conceptId: string;
  estimatedScoreImpact: number;
  estimatedEffort: number;
  rationale: string;
}

export interface UserSkillProfile {
  observations: SkillObservation[];
  conceptScores: UserConceptScore[];
  discoveredConcepts: ConceptDefinition[];
  /** Focused Mastery loop state (separate page, shared skill data). */
  focusModel?: FocusModelState;
  /**
   * @deprecated Use writingConceptStats. Migrated on hydrate.
   * Exercise-level counts only (max 1 per concept per writing exercise).
   */
  writingConceptFrequency?: Record<string, number>;
  /** Per-concept writing mistake counts: exercises flagged vs total tagged instances. */
  writingConceptStats?: Record<
    string,
    { exerciseCount: number; instanceCount: number }
  >;
}

export interface ConceptChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  changesSummary?: string;
}

export type ConceptChatContext = "instructions" | "exercises";

export interface ConceptCustomization {
  conceptId: string;
  instructionMarkdown?: string;
  drillConstraints?: string;
  gradingFeedbackConstraints?: string;
  descriptionOverride?: string;
  /** @deprecated Migrated to instructionChatMessages */
  chatMessages?: ConceptChatMessage[];
  instructionChatMessages?: ConceptChatMessage[];
  exerciseChatMessages?: ConceptChatMessage[];
  updatedAt: string;
}

export interface ConceptDrillItem {
  prompt: string;
  hint?: string;
  /** When set with correctAnswerIndex, the exercise is multiple-choice (4 options). */
  options?: string[];
  correctAnswerIndex?: number;
}

export interface ConceptDrillResult {
  index: number;
  isCorrect: boolean;
  studentAnswer: string;
  correctAnswer: string;
  feedback: string;
  /** Seconds spent on this exercise before moving on or submitting. */
  timeSpentSeconds?: number;
}

export interface ConceptGradeMetadata {
  score: { correct: number; total: number } | null;
  drillResults?: ConceptDrillResult[];
  writingResult?: ConceptWritingResult;
  estimatedBand: number;
  questionTimings?: Record<string, number>;
  sessionDurationSeconds?: number;
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
  /** Per-question tutor chat after grading (key = zero-based question index). */
  questionChats?: Record<string, ConceptChatMessage[]>;
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
  /** Saved in-progress vocabulary practice answers. */
  vocabularyProgress?: VocabularyProgress;
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
  /** Seed or discovered concept id for Concept Lab practice. */
  conceptId?: string;
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
  /** Stored so mock/writing review can rebuild verification copy text. */
  examPrompt?: string;
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
  focusHighlights?: FocusHighlight[];
  focusRankings?: FocusRankEntry[];
  drillResults?: ConceptDrillResult[];
  readingResults?: ReadingQuestionResult[];
  writingResult?: ConceptWritingResult;
  geminiUsage?: GeminiCostBreakdown;
}

export type FeedbackTicketType = "bug" | "feature";
export type FeedbackTicketStatus = "open" | "closed";

export interface FeedbackTicket {
  id: string;
  type: FeedbackTicketType;
  status: FeedbackTicketStatus;
  title: string;
  description: string;
  screenshotDataUrls: string[];
  createdAt: string;
}
