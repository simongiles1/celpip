import type { GeminiModel } from "./gemini";
import type { GeminiCostBreakdown } from "./gemini-usage";

export type FocusSubTest =
  | "Writing"
  | "Reading"
  | "Mixed"
  | "Review"
  | "Full Mock"
  | "Concept"
  | "EXAM";

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
  conceptDrillItems?: ConceptDrillItem[];
  conceptId?: string;
  setNumber?: number;
  generatedAt: string;
  geminiUsage?: GeminiCostBreakdown;
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
  studentSubmission: string | Record<string, number>;
  gradedAt: string;
  geminiUsage?: GeminiCostBreakdown;
}

export interface AppSettings {
  examDate: string;
  programStartDate: string;
  defaultSessionDurationMin: number;
}

export interface UserPreferences {
  geminiModel: GeminiModel;
}

export type SessionMode = "subtest" | "concept" | "review";

export interface GenerateResponse {
  instructions: string;
  example: string;
  examPrompt: string;
  readingQuestions?: ReadingQuestion[];
  conceptDrillItems?: ConceptDrillItem[];
  geminiUsage?: GeminiCostBreakdown;
}

export interface GradeResponse {
  estimatedBand: number;
  overallFeedback: string;
  positives: string[];
  constructiveCriticism: string[];
  grammarCorrections: GrammarCorrection[];
  skillTags?: SkillTag[];
  drillResults?: ConceptDrillResult[];
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
