import type { ConceptContext, SessionMode } from "@/lib/types";

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

  return `You are an expert CELPIP examiner. Generate a practice module for the following study unit:
Focus Sub-test: ${focusSubTest}
Target Concept: ${focusTarget}
Practice Assignment Type: ${practiceType}
${adaptiveNote}
Provide a JSON response with these exact keys:
1. "instructions": Markdown string containing a detailed tutorial and high-scoring strategies.
2. "example": An authentic CLB level 11/12 sample response or walkthrough.
3. "examPrompt": The test prompt. (If Writing: provide an email scenario or survey question. If Reading: provide a multi-paragraph text passage).
4. "readingQuestions": An array of objects containing "question", "options" (array of 4 strings), and "correctAnswerIndex" (Only if focus is Reading).

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
  ${SKILL_TAGS_SCHEMA}
}

Include skillTags for reading strategy strengths/weaknesses (e.g. distractor_analysis, inference_implied_meaning).
Return ONLY valid JSON, no markdown fences.`;
}
