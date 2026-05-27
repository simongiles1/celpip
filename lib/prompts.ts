import type {
  CelpipReadingPart,
  ConceptContext,
  ReadingQuestionType,
  SessionMode,
} from "@/lib/types";
import {
  CELPIP_MOCK_GENERATION_PREAMBLE,
  THEMED_GENERATION_PREAMBLE,
} from "@/lib/exercise-types";

const READING_PART_BLURBS: Record<CelpipReadingPart, string> = {
  part_1:
    "Part 1 (Correspondence): a short letter/email plus a reply with blanks. Tests reader comprehension of correspondence, register, and explicit detail. ~200 words, 11 questions on real CELPIP.",
  part_2:
    "Part 2 (Diagram): a labeled diagram or schedule plus a short email reply about it. Tests applying information from visuals/data. ~150-200 words, 8 questions on real CELPIP.",
  part_3:
    "Part 3 (Information Matching): a structured article split into 4 sections (A/B/C/D). Tests scanning and matching statements to source paragraphs. ~300 words, 9 questions on real CELPIP.",
  part_4:
    "Part 4 (Viewpoints): an article (news/opinion) followed by a reader comment with blanks. Tests inference, author intent, tone, and viewpoint comparison. ~300-400 words, 10 questions on real CELPIP.",
};

const READING_QUESTION_TYPE_LABELS: Record<ReadingQuestionType, string> = {
  main_idea: "main idea / gist",
  detail_extraction: "explicit detail from the text",
  inference: "inference of implied meaning",
  paraphrase_recognition: "paraphrase recognition / vocabulary synonym",
  vocabulary_in_context: "vocabulary in context",
  distractor_analysis: "fine distractor analysis (subtly wrong options)",
  tone_attitude: "tone, attitude, or author intent",
};

const READING_QUESTION_TYPE_IDS = Object.keys(
  READING_QUESTION_TYPE_LABELS,
) as ReadingQuestionType[];

const READING_PART_IDS: CelpipReadingPart[] = [
  "part_1",
  "part_2",
  "part_3",
  "part_4",
];

function formatReadingPartHint(part: CelpipReadingPart | null): string {
  if (!part) return "";
  return `\n\nTarget CELPIP Reading Part: ${part}\n${READING_PART_BLURBS[part]}\nMatch this Part's text type, register, and question style.`;
}

function formatClbBandHint(targetClbBand: number | null): string {
  if (targetClbBand == null) return "";
  const clamped = Math.max(6, Math.min(12, Math.round(targetClbBand)));
  return `\n\nDifficulty target: CLB band ${clamped}. Calibrate passage vocabulary, syntactic complexity, and distractor subtlety to this band. Lower bands (6-7) = high-frequency vocabulary, short sentences, direct/explicit questions. Mid bands (8-9) = standard register, some academic vocab, mix of literal and inference questions. High bands (10-12) = academic / formal register, idioms and collocations, abstract themes, fine-grained inference distractors that require careful elimination.`;
}

function inferReadingPartFromPracticeType(
  practiceType: string,
): CelpipReadingPart | null {
  const t = practiceType.toLowerCase();
  if (/part\s*1|correspondence/.test(t)) return "part_1";
  if (/part\s*2|diagram/.test(t)) return "part_2";
  if (/part\s*3|info[ -]?matching|information matching/.test(t)) return "part_3";
  if (/part\s*4|viewpoints/.test(t)) return "part_4";
  return null;
}

function readingTaggingBlock(): string {
  return `For EACH question include "celpipPart" (one of ${READING_PART_IDS.join(", ")}), "questionType" (one of ${READING_QUESTION_TYPE_IDS.join(", ")}), and "targetClbBand" (integer 6-12 reflecting the question's intended difficulty). Also include a passage-level "passageCelpipPart" (string) and "passageTargetClbBand" (integer 6-12). Question types: ${Object.entries(
    READING_QUESTION_TYPE_LABELS,
  )
    .map(([id, label]) => `${id} = ${label}`)
    .join("; ")}.`;
}

const SKILL_TAGS_SCHEMA = `
  "skillTags": [
    {
      "conceptId": "seed concept id (e.g. preposition_in_at_on) OR new:slug_for_unknown",
      "label": "Human-readable label (required if conceptId starts with new:)",
      "description": "Brief description (optional, for new concepts)",
      "category": "grammar|vocabulary|reading_strategy|writing_structure (optional)",
      "polarity": "strength|weakness",
      "evidence": "Specific quote or example from the student work"
    }
  ]`;

const SEED_CONCEPT_IDS = [
  "preposition_in_at_on",
  "infinitive_to_usage",
  "articles_a_an_the",
  "subject_verb_agreement",
  "verb_tenses",
  "connectors_transitions",
  "formal_tone_register",
  "paragraph_structure",
  "task_fulfillment",
  "vocabulary_precision",
  "collocations",
  "skimming_scanning",
  "distractor_analysis",
  "inference_implied_meaning",
  "main_idea_identification",
  "paraphrase_recognition",
  "punctuation_mechanics",
  "sentence_variety",
].join(", ");

function formatConceptList(concepts: ConceptContext[] | undefined): string {
  if (!concepts?.length) return "";
  return concepts
    .map((c) => `- ${c.label}${c.evidence ? `: ${c.evidence}` : ""}`)
    .join("\n");
}

export function getConceptDrillConstraints(conceptId: string | undefined): string {
  if (conceptId === "infinitive_to_usage") {
    return `
CONCEPT-SPECIFIC DRILL RULES (follow strictly):
- This drill is ONLY about inserting or omitting "to" after verbs of movement toward a place. It is NOT about choosing at/in/on or other prepositions.
- DO NOT use arrive, reach, enter, or visit in fill-in-the-blank prompts where the natural answer would be at, on, in, or a bare noun. Those scenarios belong in a different lesson and produce awkward sentences (e.g. "arrive ___ your doorstep").
- Include roughly half the items where the correct answer is "to" after movement verbs such as go, walk, drive, travel, head, move, fly, or run (e.g. "We drove ___ the airport").
- For "when NOT to use to", use one-sentence rewrites that remove an incorrect "to" after enter, arrive, reach, or visit (e.g. "Fix: She entered to the building." → "She entered the building."). Do not use fill-in-the-blank for those cases.
- Every item must have one clear, natural best answer that directly tests the to / no-to rule.`;
  }

  return "";
}

export function buildGenerationPrompt(
  focusSubTest: string,
  focusTarget: string,
  practiceType: string,
  options?: {
    sessionMode?: SessionMode;
    weakConcepts?: ConceptContext[];
    strongConcepts?: ConceptContext[];
    targetConceptLabel?: string;
    targetConceptDescription?: string;
    targetConceptId?: string;
    conceptExercisesOnly?: boolean;
    conceptSetNumber?: number;
    conceptDescriptionOverride?: string;
    conceptDrillConstraintsOverride?: string;
    targetClbBand?: number;
  },
): string {
  const mode = options?.sessionMode ?? "subtest";
  const weakBlock = formatConceptList(options?.weakConcepts);
  const strongBlock = formatConceptList(options?.strongConcepts);

  if (mode === "concept" && options?.targetConceptLabel) {
    return buildConceptDrillPrompt(
      options.targetConceptLabel,
      options.conceptDescriptionOverride ??
        options.targetConceptDescription ??
        focusTarget,
      {
        conceptId: options.targetConceptId,
        exercisesOnly: options.conceptExercisesOnly,
        setNumber: options.conceptSetNumber,
        drillConstraintsOverride: options.conceptDrillConstraintsOverride,
      },
    );
  }

  let adaptiveNote = "";
  if (mode === "review" && weakBlock) {
    adaptiveNote = `\nIMPORTANT: Build this entire review module around clearing these student weaknesses:\n${weakBlock}\n`;
  } else if (weakBlock) {
    adaptiveNote = `\nStudent weakness areas (embed subtle practice opportunities in the scenario without changing the task format):\n${weakBlock}\n`;
  }
  if (strongBlock) {
    adaptiveNote += `\nStudent strengths (maintain appropriate challenge level):\n${strongBlock}\n`;
  }

  const isReadingFocus =
    focusSubTest === "Reading" ||
    practiceType.toLowerCase().includes("reading") ||
    practiceType.toLowerCase().includes("part");

  const inferredPart = isReadingFocus
    ? inferReadingPartFromPracticeType(practiceType)
    : null;
  const readingPartHint = formatReadingPartHint(inferredPart);
  const clbHint = isReadingFocus
    ? formatClbBandHint(options?.targetClbBand ?? null)
    : "";
  const readingTagSpec = isReadingFocus
    ? `\n5. ${readingTaggingBlock()}`
    : "";

  return `You are an expert CELPIP instructor building THEMED PRACTICE for a personal study plan.
${THEMED_GENERATION_PREAMBLE}

Focus Sub-test: ${focusSubTest}
Target skill / theme (primary): ${focusTarget}
Format reference (secondary): ${practiceType}${readingPartHint}${clbHint}
${adaptiveNote}
Provide a JSON response with these exact keys:
1. "instructions": Markdown tutorial tied to today's target skill (${focusTarget}), not generic test-day advice.
2. "example": A worked example demonstrating the target skill at CLB 11/12 level.
3. "examPrompt": The practice prompt${isReadingFocus ? " (reading passage in the CELPIP Part format above, full length and complexity)" : " (writing scenario)"}.
4. "readingQuestions": An array of objects containing "question", "options" (array of 4 strings), "correctAnswerIndex"${isReadingFocus ? `, "celpipPart", "questionType", and "targetClbBand"` : ""} (Only if focus is Reading). Match the CELPIP Part's official question count when given (Part 1=11, Part 2=8, Part 3=9, Part 4=10); otherwise use 8-10 questions.${readingTagSpec}
${isReadingFocus ? `6. "passageCelpipPart": one of part_1/part_2/part_3/part_4 reflecting the overall passage format.\n7. "passageTargetClbBand": integer 6-12 reflecting the overall passage difficulty.\n` : ""}
Return ONLY valid JSON, no markdown fences.`;
}

export function buildReadingPassageOnlyPrompt(
  focusTarget: string,
  practiceType: string,
  options?: {
    setNumber?: number;
    weakConcepts?: ConceptContext[];
    strongConcepts?: ConceptContext[];
    targetClbBand?: number;
  },
): string {
  const setNote =
    options?.setNumber != null
      ? `\nThis is passage ${options.setNumber} in the same study session. Use a completely new scenario, topic, and wording — do not repeat prior passages.`
      : "";

  const weakBlock = formatConceptList(options?.weakConcepts);
  const strongBlock = formatConceptList(options?.strongConcepts);

  let adaptiveNote = "";
  if (weakBlock) {
    adaptiveNote += `\nStudent weakness areas (embed subtle practice in questions):\n${weakBlock}\n`;
  }
  if (strongBlock) {
    adaptiveNote += `\nStudent strengths (maintain challenge):\n${strongBlock}\n`;
  }

  const inferredPart = inferReadingPartFromPracticeType(practiceType);
  const partHint = formatReadingPartHint(inferredPart);
  const clbHint = formatClbBandHint(options?.targetClbBand ?? null);

  const isMock = /all reading parts|38 questions|mixed mini/i.test(practiceType);
  const questionCount = isMock ? "8 to 12" : "8 to 10";

  return `You are an expert CELPIP instructor. Generate a NEW themed reading passage (not an official test item).
${THEMED_GENERATION_PREAMBLE}

Target skill / theme (primary): ${focusTarget}
Format reference (secondary): ${practiceType}${partHint}${clbHint}${setNote}${adaptiveNote}

Provide a JSON response with these exact keys:
1. "examPrompt": A reading passage matching the CELPIP Part format above (full length, full complexity, exam-realistic distractors).
2. "readingQuestions": An array of ${questionCount} objects, each with "question", "options" (array of exactly 4 strings), "correctAnswerIndex" (0-3), "celpipPart", "questionType", and "targetClbBand" (integer 6-12).
3. ${readingTaggingBlock()}
4. "passageCelpipPart": one of part_1/part_2/part_3/part_4 reflecting the overall passage format.
5. "passageTargetClbBand": integer 6-12 reflecting the overall passage difficulty.

Return ONLY valid JSON, no markdown fences.`;
}

export function buildConceptDrillPrompt(
  conceptLabel: string,
  conceptDescription: string,
  options?: {
    conceptId?: string;
    exercisesOnly?: boolean;
    setNumber?: number;
    drillConstraintsOverride?: string;
  },
): string {
  const setNote =
    options?.setNumber != null
      ? `\nThis is question set ${options.setNumber}. Use fresh scenarios and wording that differ from earlier sets.`
      : "";
  const conceptConstraints =
    options?.drillConstraintsOverride?.trim() ||
    getConceptDrillConstraints(options?.conceptId);

  if (options?.exercisesOnly) {
    return `You are an expert CELPIP English instructor. Create a new exercise set for this concept:

Concept: ${conceptLabel}
Description: ${conceptDescription}${setNote}${conceptConstraints}

Provide a JSON response with these exact keys:
1. "examPrompt": A mini writing prompt (2-3 sentences the student should write applying this concept).
2. "conceptDrillItems": An array of exactly 8 objects with "prompt" (fill-in-the-blank with a single word or short phrase, or a one-sentence rewrite) and optional "hint". Mix time and place contexts when relevant. Keep prompts concise; answers should be 1-3 words unless rewriting a full sentence.

Return ONLY valid JSON, no markdown fences.`;
  }

  return `You are an expert CELPIP English instructor. Create a focused micro-skill drill for this concept:

Concept: ${conceptLabel}
Description: ${conceptDescription}${setNote}${conceptConstraints}

Provide a JSON response with these exact keys:
1. "instructions": Markdown tutorial explaining the rule with 2-3 clear examples and counter-examples (e.g. when NOT to use a word).
2. "example": A worked example showing correct usage.
3. "examPrompt": A mini writing prompt (2-3 sentences the student should write applying this concept).
4. "conceptDrillItems": An array of exactly 8 objects with "prompt" (fill-in-the-blank with a single word or short phrase, or a one-sentence rewrite) and optional "hint". Mix time and place contexts when relevant. Keep prompts concise; answers should be 1-3 words unless rewriting a full sentence.

Return ONLY valid JSON, no markdown fences.`;
}

export function buildConceptChatPrompt(input: {
  conceptLabel: string;
  conceptDescription: string;
  instructionDocument: string;
  drillConstraints: string;
  currentQuestions: string[];
  userMessage: string;
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>;
}): string {
  const historyBlock =
    input.chatHistory.length > 0
      ? input.chatHistory
          .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
          .join("\n\n")
      : "(No prior messages.)";

  const questionsBlock =
    input.currentQuestions.length > 0
      ? input.currentQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")
      : "(No exercises loaded yet.)";

  return `You are an expert CELPIP English instructor helping a student refine a micro-skill concept lesson.

The student is studying: "${input.conceptLabel}"

You can update three things based on their feedback:
1. **instructionMarkdown** — the full markdown shown on the Instructions tab (rules, examples, counter-examples). Use clear headings and bullet points.
2. **drillConstraints** — rules appended to the AI prompt that generates exercise questions. Use this to ban poor question types, require fill-in-the-blank only, specify coverage areas, etc. Write as imperative bullet rules starting with "-".
3. **descriptionOverride** — a short 1-3 sentence summary of the concept used when generating new exercises.

CURRENT STATE:
---
Short description: ${input.conceptDescription}

Instructions (markdown):
${input.instructionDocument}

Exercise generation constraints:
${input.drillConstraints || "(None — using defaults.)"}

Current exercise prompts:
${questionsBlock}
---

CHAT HISTORY:
${historyBlock}

NEW STUDENT MESSAGE:
${input.userMessage}

Analyze the student's feedback. If they point out gaps in instructions, bad exercise formats, missing rules, or unclear examples, update the relevant fields.

Rules for your response:
- Be concise and helpful in "reply".
- Only include fields in "updates" that actually change. Omit unchanged fields.
- When updating instructionMarkdown, provide the COMPLETE new document (not a diff).
- When updating drillConstraints, provide the COMPLETE constraint block that should replace any prior custom constraints.
- If exercise rules changed, mention in reply that they should click "New question set" to regenerate exercises.
- Set "changesSummary" to a one-line note of what you changed, or null if nothing changed.

Return ONLY valid JSON:
{
  "reply": "Your conversational response to the student",
  "changesSummary": "Brief note of changes made, or null",
  "updates": {
    "instructionMarkdown": "optional full markdown",
    "drillConstraints": "optional full constraint block",
    "descriptionOverride": "optional short description"
  }
}

Omit "updates" entirely or use an empty object if no changes are needed.`;
}

export function buildGradingPrompt(
  focusSubTest: string,
  examPrompt: string,
  studentSubmission: string,
): string {
  return `You are an authorized CELPIP Test Grader. Grade this student response based on official criteria:
Sub-Test Unit: ${focusSubTest}
Target Assignment: ${examPrompt}
Student Work Submitted: ${studentSubmission}

Known concept IDs for skillTags: ${SEED_CONCEPT_IDS}
Use a seed conceptId when the issue matches. Use "new:slug" only for patterns not covered by seed IDs.

Evaluate across: Task Fulfillment, Organization/Coherence, Vocabulary, and Sentence Variety/Grammar.
Provide a clean JSON response:
{
  "estimatedBand": 1-12,
  "overallFeedback": "string markdown",
  "positives": ["string"],
  "constructiveCriticism": ["string"],
  "grammarCorrections": [{"original": "str", "corrected": "str", "reason": "str"}],
  ${SKILL_TAGS_SCHEMA}
}

Include 1-5 skillTags identifying specific grammar/vocabulary/strategy strengths and weaknesses observed.
Return ONLY valid JSON, no markdown fences.`;
}

export function buildConceptGradingPrompt(
  conceptLabel: string,
  examPrompt: string,
  drillResponses: string,
  studentSubmission: string,
): string {
  return `You are an expert English instructor grading a focused concept drill.

Concept: ${conceptLabel}
Drill exercises: ${drillResponses}
Mini writing prompt: ${examPrompt}
Student responses: ${studentSubmission}

Known concept IDs for skillTags: ${SEED_CONCEPT_IDS}

Grade each drill exercise individually. Provide JSON:
{
  "estimatedBand": 1-12,
  "overallFeedback": "string markdown — brief summary only (2-3 sentences max)",
  "positives": ["string"],
  "constructiveCriticism": ["string"],
  "grammarCorrections": [{"original": "str", "corrected": "str", "reason": "str"}],
  "drillResults": [
    {
      "index": 0,
      "isCorrect": true,
      "studentAnswer": "what the student wrote",
      "correctAnswer": "the best acceptable answer",
      "feedback": "one sentence explaining why correct or incorrect"
    }
  ],
  "writingResult": {
    "isAcceptable": true,
    "feedback": "brief feedback on the mini writing response"
  },
  ${SKILL_TAGS_SCHEMA}
}

Include one drillResults entry per drill exercise in order (index 0, 1, 2, …). Accept reasonable synonyms for fill-in-the-blank answers.
Focus skillTags on the target concept "${conceptLabel}".
Return ONLY valid JSON, no markdown fences.`;
}

export function buildReadingGradingPrompt(
  examPrompt: string,
  studentSubmission: string,
  scoreSummary: string,
  questionCount: number,
): string {
  return `You are an authorized CELPIP Reading Test Grader.
Reading Passage/Prompt: ${examPrompt}
Student Answers: ${studentSubmission}
Automatic Score Summary: ${scoreSummary}

Known concept IDs for skillTags: ${SEED_CONCEPT_IDS}

Provide CELPIP-style feedback as JSON:
{
  "estimatedBand": 1-12,
  "overallFeedback": "string markdown",
  "positives": ["string"],
  "constructiveCriticism": ["string"],
  "grammarCorrections": [],
  "readingResults": [
    {
      "index": 0,
      "feedback": "Brief feedback for question 1. If the student was wrong, explain why the correct answer fits the passage.",
      "celpipPart": "part_1|part_2|part_3|part_4 (preserve from the question if present, otherwise classify the question)",
      "questionType": "${READING_QUESTION_TYPE_IDS.join("|")}",
      "targetClbBand": 6
    }
  ],
  ${SKILL_TAGS_SCHEMA}
}

Include exactly ${questionCount} readingResults entries in order (index 0 through ${questionCount - 1}).
For correct answers, give brief reinforcement. For incorrect answers, explain why the correct option is right and why the student's choice was wrong.
Always populate "celpipPart", "questionType", and "targetClbBand" (6-12) for every result, even if the source question lacked them.
Include skillTags for reading strategy strengths/weaknesses (e.g. distractor_analysis, inference_implied_meaning).
Return ONLY valid JSON, no markdown fences.`;
}

export type CelpipMockSegmentTarget =
  | { kind: "reading_part"; celpipPart: CelpipReadingPart; questionCount: number }
  | { kind: "writing_task"; task: "task_1" | "task_2" };

export function buildCelpipMockPrompt(input: {
  target: CelpipMockSegmentTarget;
  targetClbBand?: number;
}): string {
  const clbHint = formatClbBandHint(input.targetClbBand ?? 10);

  if (input.target.kind === "writing_task") {
    const isTask1 = input.target.task === "task_1";
    const taskLabel = isTask1
      ? "Task 1: Writing an Email"
      : "Task 2: Responding to Survey Questions";
    const taskDetail = isTask1
      ? "Task 1 is a 27-minute email writing task. Provide a realistic situation, recipient identification, the reason the candidate is writing, and three concrete bullet points the response must address. Tone may be formal or informal depending on the recipient relationship."
      : "Task 2 is a 26-minute survey opinion task. Provide a survey question with exactly two clearly distinct options labelled. The candidate must pick one option and justify their choice with reasons and examples in 150-200 words.";

    return `You are an authorized CELPIP test author. Generate an OFFICIAL-FORMAT CELPIP Writing prompt.
${CELPIP_MOCK_GENERATION_PREAMBLE}

${taskLabel}
${taskDetail}${clbHint}

Return a JSON object with exactly one key: {"examPrompt": "<the writing scenario, formatted in markdown when helpful>"}.

Return ONLY valid JSON, no markdown fences.`;
  }

  const part = input.target.celpipPart;
  const partBlurb = READING_PART_BLURBS[part];
  const questionCount = input.target.questionCount;

  return `You are an authorized CELPIP test author. Generate an OFFICIAL-FORMAT CELPIP Reading passage.
${CELPIP_MOCK_GENERATION_PREAMBLE}

Target Part: ${part}
${partBlurb}${clbHint}

This is a strict CELPIP practice test item — match official length, register, structure, and distractor design exactly. No scaffolding, no vocabulary glosses, no skill hints.

Provide a JSON response with these exact keys:
1. "examPrompt": The reading passage in CELPIP ${part} format (full length, full complexity).
2. "readingQuestions": An array of exactly ${questionCount} objects, each with "question", "options" (4 strings), "correctAnswerIndex" (0-3), "celpipPart" = "${part}", "questionType" (one of ${READING_QUESTION_TYPE_IDS.join("/")}), and "targetClbBand" (integer 6-12).
3. "passageCelpipPart": "${part}".
4. "passageTargetClbBand": integer 6-12.

Return ONLY valid JSON, no markdown fences.`;
}
