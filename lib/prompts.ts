import {
  formatConceptDrillItemsGenerationSpec,
  isMultipleChoiceConcept,
} from "@/lib/concept-drill-mc";
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

function inferPreferredQuestionTypes(focusTarget: string): ReadingQuestionType[] {
  const t = focusTarget.toLowerCase();
  const out: ReadingQuestionType[] = [];
  if (/inference|implied|tone|attitude|author intent|viewpoint|nuance/.test(t))
    out.push("inference", "tone_attitude");
  if (/main idea|gist|overall/.test(t)) out.push("main_idea");
  if (/detail|fact|extract|specific/.test(t)) out.push("detail_extraction");
  if (/paraphras|synonym|vocabulary in context|matching abstract/.test(t))
    out.push("paraphrase_recognition", "vocabulary_in_context");
  if (/distract|elimination|process of elimination/.test(t))
    out.push("distractor_analysis");
  if (/skimming|scanning|info[ -]?matching/.test(t))
    out.push("main_idea", "detail_extraction");
  return Array.from(new Set(out));
}

function formatQuestionMixBias(focusTarget: string): string {
  const preferred = inferPreferredQuestionTypes(focusTarget);
  if (!preferred.length) return "";
  return `\n\nQuestion-mix bias: Roughly 60% of questions should target these question types: ${preferred.join(", ")}. Fill the remaining ~40% with other types so the passage still resembles a real CELPIP Part.`;
}

function formatThemedWritingTaskHint(practiceType: string): string {
  const t = practiceType.toLowerCase();
  if (/email|task\s*1/.test(t)) {
    return `\n\nWriting task structure (CELPIP Task 1 — Email): Provide a realistic email scenario with a recipient, a reason for writing, and exactly three bullet points the student must address. Target response length: 150-200 words. Tone may be formal or informal depending on the recipient relationship.`;
  }
  if (/survey|task\s*2/.test(t)) {
    return `\n\nWriting task structure (CELPIP Task 2 — Survey Opinion): Provide a survey question with exactly two clearly labelled options. The student must pick one option and defend their choice with reasons and examples. Target response length: 150-200 words.`;
  }
  return `\n\nWriting task structure: Provide a realistic CELPIP-style writing scenario. Target response length: 150-200 words.`;
}

function readingTaggingBlock(): string {
  return `For EACH question include "celpipPart" (one of ${READING_PART_IDS.join(", ")}), "questionType" (one of ${READING_QUESTION_TYPE_IDS.join(", ")}), and "targetClbBand" (integer 6-12 reflecting the question's intended difficulty). Also include a passage-level "passageCelpipPart" (string) and "passageTargetClbBand" (integer 6-12). Question types: ${Object.entries(
    READING_QUESTION_TYPE_LABELS,
  )
    .map(([id, label]) => `${id} = ${label}`)
    .join("; ")}.`;
}

const GRAMMAR_CORRECTIONS_GUIDANCE = `
For each grammarCorrections entry, write "reason" as 2-3 short sentences for an English learner (about 40-70 words — a little more detail than a one-line rule, but not a long lesson):
- Sentence 1: Name the specific mistake in the student's original phrase (wrong preposition, missing subject, adjective used where a noun is needed, etc.).
- Sentence 2: Explain the rule or pattern in plain language — say WHY the correction works, not only that it is "correct" or "more natural."
- If the fix changes more than one word, add one brief sentence on how the corrected phrase fits together as a whole sentence.
- "original" must be an exact verbatim substring copied from the student submission so it can be highlighted inline.
- Include "conceptId" on every entry — use the same seed conceptId as the matching weakness skillTag (e.g. comma splice → punctuation_mechanics).

Avoid terse fragments joined by semicolons (e.g. "'X' is correct. 'Y' is wrong. 'Z' is natural."). Write flowing, complete sentences the student can learn from.
Include up to 8 grammarCorrections for substantive errors; skip minor typos unless they affect meaning.`;

const SKILL_TAGGING_GUIDANCE = `
SKILL TAGGING (required — powers Concept Lab practice links):
- Include one skillTag for each distinct weakness in constructiveCriticism (minimum 1, maximum 8 weakness tags). Add up to 3 strength tags for clear positives.
- Prefer these seed conceptIds when the weakness matches: verb tenses / tense errors → verb_tenses; comma splices / run-ons / missing commas → punctuation_mechanics; sentence structure / complex sentences / repetitive structure → sentence_variety; preposition errors → preposition_in_at_on; articles → articles_a_an_the; idiomatic or awkward phrases / unnatural collocations → collocations; formal tone / register → formal_tone_register; paragraph organization → paragraph_structure; connectors / transitions → connectors_transitions; vocabulary precision → vocabulary_precision; subject-verb agreement → subject_verb_agreement; infinitive "to" errors → infinitive_to_usage.
- Use polarity "weakness" for areas to improve and "strength" for positives.
- Each weakness tag's "evidence" must quote or closely paraphrase a specific phrase from the student submission.
- Only use "new:slug" when no seed concept fits; always include "label" and "description" for new concepts so drills can be generated.`;

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

const MULTIPLE_CHOICE_DRILL_RULES = `
MULTIPLE-CHOICE FORMAT (follow strictly):
- Every item must have exactly 4 options and one correctAnswerIndex (0-3).
- Do NOT use free-text fill-in-the-blank. Options must appear only in the "options" array, not duplicated in the prompt.
- Distractors must be plausible but clearly wrong to a learner who knows the rule.
- Options are ONLY what goes in the ___ blank. If the prompt already has words after ___ (e.g. "___ however, no decision…"), do NOT repeat those words inside any option.
- All four options must produce clearly different sentences when inserted at ___. Never offer two options that mean the same thing in context (e.g. "," vs ", however," when "however" already follows the blank).
- REQUIRED on every item: "acceptableAnswerIndexes" — list every option index (0-3) that is natural and grammatical when inserted (must include correctAnswerIndex). Read the sentence with each option before finalizing.
- When only one option works, acceptableAnswerIndexes is a one-element array (single-select in the app).
- When two or more options genuinely work, include every working index and start the prompt with "Select all that could correctly complete the sentence:". Use multi-answer sparingly — only when multiple answers are truly defensible.`;

export const CONCEPT_DRILL_HINT_GUIDANCE = `
HINT QUALITY (required when the student's answer is wrong):
- Anchor the hint to a concrete phrase or idea IN the exercise sentence (e.g. "the main entrance", "the second weekend of September") — not vague questions like "which option fits best?"
- Name what kind of thing the sentence is describing in plain language (a specific spot or point, a calendar date, a month as a container, a movement toward a place, etc.) and how that relates to the concept being practiced.
- Include ONE short negative example in the form "You wouldn't say '…'" — combine the wrong direction the student took with an unnatural collocation so the pattern clicks (e.g. "You wouldn't say 'meet on a place'" or "You wouldn't say 'in September 13th'").
- Teach a reusable correlation the learner can apply elsewhere, without naming or quoting the correct answer option.
- 2-3 sentences total. Plain, friendly language. No grammar jargon.`;

export const DEFAULT_GRADING_FEEDBACK_CONSTRAINTS = `
- Use plain, friendly language. Avoid grammar jargon (comma splice, independent clause, conjunctive adverb, adverbial clause, essential clause).
- Explain in one or two short sentences what to choose and why — as if talking to a friend, not a linguistics class.
- Refer to answer options by their text, not by index.
- Example good: "Use a semicolon here — both parts are full sentences, and 'however' already shows the contrast."
- Example bad: "The student's choice would create a comma splice between independent clauses."`;

export function getConceptDrillConstraints(conceptId: string | undefined): string {
  if (conceptId === "preposition_in_at_on") {
    return `
CONCEPT-SPECIFIC DRILL RULES (follow strictly):
${MULTIPLE_CHOICE_DRILL_RULES}
- Test choosing in, at, or on for time and place. Mix both contexts across the set.
- For most items, use a sentence with ___ and four preposition options (in / at / on / a plausible wrong preposition).
- Include at least 2 time items and 2 place items.
- Do not test "to" movement or article choice in this set.`;
  }

  if (conceptId === "infinitive_to_usage") {
    return `
CONCEPT-SPECIFIC DRILL RULES (follow strictly):
${MULTIPLE_CHOICE_DRILL_RULES}
- This drill is ONLY about inserting or omitting "to" after verbs of movement toward a place. It is NOT about choosing at/in/on.
- DO NOT use arrive, reach, enter, or visit in prompts where the natural answer would be at, on, in, or a bare noun.
- Include roughly half the items where the correct option is "to" after movement verbs (go, walk, drive, travel, head, move, fly, run). Use ___ in the prompt and include "to" plus distractors such as "at", "in", or "—" (no word).
- For "when NOT to use to", ask "Which sentence is correct?" with four full-sentence options fixing enter/arrive/reach/visit errors (e.g. remove an incorrect "to").
- Every item must have one clear, natural best answer that directly tests the to / no-to rule.`;
  }

  if (conceptId === "articles_a_an_the") {
    return `
CONCEPT-SPECIFIC DRILL RULES (follow strictly):
${MULTIPLE_CHOICE_DRILL_RULES}
- Test a, an, the, or no article. Use "(no article)" or "—" as the fourth option when zero article is correct.
- Use formal CELPIP-style sentences with a single article slot marked by ___.`;
  }

  if (conceptId === "connectors_transitions") {
    return `
CONCEPT-SPECIFIC DRILL RULES (follow strictly):
${MULTIPLE_CHOICE_DRILL_RULES}
- Test formal linking words (however, therefore, furthermore, moreover, nevertheless, consequently, in addition, etc.).
- Each prompt is a two-clause sentence with ___ between clauses, or asks which connector best joins two ideas.
- Distractors should be real connectors that do not fit the logic (contrast vs cause vs addition).
- If the connector word already appears in the prompt after ___, options must be punctuation only (e.g. ",", ";", ".", "—") — never ", however," when "however" follows the blank.`;
  }

  if (conceptId === "collocations") {
    return `
CONCEPT-SPECIFIC DRILL RULES (follow strictly):
${MULTIPLE_CHOICE_DRILL_RULES}
- Test natural word combinations and formal phrasal verbs. Each item has one blank with four collocation options.
- Include at least one verb+noun collocation and one adjective+noun or verb+preposition collocation.
- Distractors should be common learner errors (e.g. "do a decision" vs "make a decision").`;
  }

  if (conceptId === "vocabulary_precision") {
    return `
CONCEPT-SPECIFIC DRILL RULES (follow strictly):
${MULTIPLE_CHOICE_DRILL_RULES}
- Test choosing the most precise or formal word for CELPIP writing. Each item has ___ with four single-word or short-phrase options.
- Distractors should be vague, informal, or slightly wrong-register words.`;
  }

  if (conceptId === "formal_tone_register") {
    return `
CONCEPT-SPECIFIC DRILL RULES (follow strictly):
${MULTIPLE_CHOICE_DRILL_RULES}
- Ask which sentence is more appropriate for formal CELPIP writing (email or survey response).
- Provide four complete sentence options. Only one should be suitably formal; others may be too casual, rude, or vague.
- Do not use blanks; the full sentences are the options.`;
  }

  if (conceptId === "punctuation_mechanics") {
    return `
CONCEPT-SPECIFIC DRILL RULES (follow strictly):
${MULTIPLE_CHOICE_DRILL_RULES}
- Test comma, semicolon, period, apostrophe, or no punctuation at a single marked slot (___).
- Options should be punctuation marks or short fragments (e.g. ",", ";", ".", "—", ", and").
- If a conjunctive adverb (however, therefore, moreover, etc.) already appears in the prompt immediately after ___, options must be punctuation ONLY — not ", however," or "; however,".
- Include comma splice and run-on fixes across the set.`;
  }

  if (conceptId === "paraphrase_recognition") {
    return `
CONCEPT-SPECIFIC DRILL RULES (follow strictly):
${MULTIPLE_CHOICE_DRILL_RULES}
- Provide a short source sentence in the prompt, then ask which option has the same meaning (paraphrase).
- All four options should be complete sentences or clauses with similar wording but only one matching meaning.
- Distractors should change scope, polarity, or a key detail subtly.`;
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
  const questionMixBias = isReadingFocus ? formatQuestionMixBias(focusTarget) : "";
  const writingTaskHint =
    focusSubTest === "Writing" && !isReadingFocus
      ? formatThemedWritingTaskHint(practiceType)
      : "";
  const readingQuestionsSpec = isReadingFocus
    ? `(Only if focus is Reading). Use 5-7 questions per passage.${questionMixBias}${readingTagSpec}`
    : `(Only if focus is Reading). Omit this key for writing sessions.`;

  return `You are an expert CELPIP instructor building THEMED PRACTICE for a personal study plan.
${THEMED_GENERATION_PREAMBLE}

Focus Sub-test: ${focusSubTest}
Target skill / theme (primary): ${focusTarget}
Format reference (secondary): ${practiceType}${readingPartHint}${clbHint}${questionMixBias}${writingTaskHint}
${adaptiveNote}
Provide a JSON response with these exact keys:
1. "instructions": Markdown tutorial tied to today's target skill (${focusTarget}), not generic test-day advice. Use GFM markdown only — no HTML.
2. "example": A worked example demonstrating the target skill at CLB 11/12 level (GFM markdown only).
3. "examPrompt": The practice prompt${isReadingFocus ? " (reading passage in the CELPIP Part format above, full length and complexity; GFM markdown only — use markdown tables for schedules/diagrams, never HTML)" : " (writing scenario; GFM markdown only)"}.
4. "readingQuestions": An array of objects containing "question", "options" (array of 4 strings), "correctAnswerIndex"${isReadingFocus ? `, "celpipPart", "questionType", and "targetClbBand"` : ""} ${readingQuestionsSpec}
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
  const questionCount = isMock ? "8 to 12" : "5 to 7";
  const questionMixBias = formatQuestionMixBias(focusTarget);

  return `You are an expert CELPIP instructor. Generate a NEW themed reading passage.
${THEMED_GENERATION_PREAMBLE}

Target skill / theme (primary): ${focusTarget}
Format reference (secondary): ${practiceType}${partHint}${clbHint}${questionMixBias}${setNote}${adaptiveNote}

Provide a JSON response with these exact keys:
1. "examPrompt": A reading passage matching the CELPIP Part format above (full length, full complexity, exam-realistic distractors; GFM markdown only — use markdown tables for schedules/diagrams, never HTML).
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
  const drillItemsSpec = formatConceptDrillItemsGenerationSpec(
    options?.conceptId,
  );
  const mcNote = isMultipleChoiceConcept(options?.conceptId)
    ? "\nUse multiple-choice format for every exercise (exactly 4 options each)."
    : "";

  if (options?.exercisesOnly) {
    return `You are an expert CELPIP English instructor. Create a new exercise set for this concept:

Concept: ${conceptLabel}
Description: ${conceptDescription}${setNote}${conceptConstraints}${mcNote}

Provide a JSON response with these exact keys:
1. ${drillItemsSpec}

Return ONLY valid JSON, no markdown fences.`;
  }

  return `You are an expert CELPIP English instructor. Create a focused micro-skill drill for this concept:

Concept: ${conceptLabel}
Description: ${conceptDescription}${setNote}${conceptConstraints}${mcNote}

Provide a JSON response with these exact keys:
1. "instructions": Markdown tutorial explaining the rule with 2-3 clear examples and counter-examples (e.g. when NOT to use a word). Use GFM markdown only — no HTML.
2. "example": A worked example showing correct usage (GFM markdown only).
3. ${drillItemsSpec}

Return ONLY valid JSON, no markdown fences.`;
}

export function buildConceptChatPrompt(input: {
  chatContext: "instructions" | "exercises";
  conceptLabel: string;
  conceptDescription: string;
  instructionDocument: string;
  drillConstraints: string;
  gradingFeedbackConstraints: string;
  currentQuestions: string[];
  recentGradingFeedback: string;
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

  if (input.chatContext === "instructions") {
    return `You are an expert CELPIP English instructor helping a student refine the **Instructions** for a micro-skill concept lesson.

The student is studying: "${input.conceptLabel}"

You can update two things based on their feedback:
1. **instructionMarkdown** — the full markdown shown on the Instructions tab (rules, examples, counter-examples). Use clear headings and bullet points.
2. **descriptionOverride** — a short 1-3 sentence summary of the concept used when generating new exercises.

CURRENT STATE:
---
Short description: ${input.conceptDescription}

Instructions (markdown):
${input.instructionDocument}
---

CHAT HISTORY:
${historyBlock}

NEW STUDENT MESSAGE:
${input.userMessage}

Analyze the student's feedback about the instructions. If they point out gaps, missing rules, unclear examples, or wrong explanations, update the relevant fields.

Rules for your response:
- Be concise and helpful in "reply".
- Only include fields in "updates" that actually change. Omit unchanged fields.
- When updating instructionMarkdown, provide the COMPLETE new document (not a diff).
- Do NOT update drillConstraints or gradingFeedbackConstraints — this chat is instructions-only.
- Set "changesSummary" to a one-line note of what you changed, or null if nothing changed.

Return ONLY valid JSON:
{
  "reply": "Your conversational response to the student",
  "changesSummary": "Brief note of changes made, or null",
  "updates": {
    "instructionMarkdown": "optional full markdown",
    "descriptionOverride": "optional short description"
  }
}

Omit "updates" entirely or use an empty object if no changes are needed.`;
  }

  return `You are an expert CELPIP English instructor helping a student refine the **Exercises** for a micro-skill concept lesson.

The student is studying: "${input.conceptLabel}"

You can update two things based on their feedback:
1. **drillConstraints** — rules appended to the AI prompt that generates exercise questions. Use this to ban poor question types, fix duplicate options, require fill-in-the-blank only, specify coverage areas, etc. Write as imperative bullet rules starting with "-".
2. **gradingFeedbackConstraints** — rules for how the AI explains correct/incorrect answers after the student submits exercises. Use this when feedback is too technical, unclear, too long, or missing key points. Write as imperative bullet rules starting with "-".

CURRENT STATE:
---
Short description: ${input.conceptDescription}

Exercise generation constraints:
${input.drillConstraints || "(None — using defaults.)"}

Grading feedback style constraints:
${input.gradingFeedbackConstraints || DEFAULT_GRADING_FEEDBACK_CONSTRAINTS}

Current exercise prompts:
${questionsBlock}

Recent grading feedback shown to the student:
${input.recentGradingFeedback || "(No graded attempts yet.)"}
---

CHAT HISTORY:
${historyBlock}

NEW STUDENT MESSAGE:
${input.userMessage}

Analyze the student's feedback about exercises or grading explanations. If they report bad question formats, duplicate answer options, confusing prompts, or overly technical post-grade feedback, update the relevant fields.

Rules for your response:
- Be concise and helpful in "reply".
- Only include fields in "updates" that actually change. Omit unchanged fields.
- When updating drillConstraints or gradingFeedbackConstraints, provide the COMPLETE constraint block that should replace any prior custom constraints.
- If exercise generation rules changed, mention in reply that they should click "New question set" to regenerate exercises.
- If only grading feedback style changed, mention that future submissions will use the new style (past grades are unchanged).
- Do NOT update instructionMarkdown — this chat is exercises-only.
- Set "changesSummary" to a one-line note of what you changed, or null if nothing changed.

Return ONLY valid JSON:
{
  "reply": "Your conversational response to the student",
  "changesSummary": "Brief note of changes made, or null",
  "updates": {
    "drillConstraints": "optional full constraint block",
    "gradingFeedbackConstraints": "optional full constraint block"
  }
}

Omit "updates" entirely or use an empty object if no changes are needed.`;
}

export function buildConceptCreateChatPrompt(input: {
  existingConcepts: Array<{ label: string; category: string; description: string }>;
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}): string {
  const conceptsBlock =
    input.existingConcepts.length > 0
      ? input.existingConcepts
          .map(
            (c, i) =>
              `${i + 1}. ${c.label} (${c.category}) — ${c.description}`,
          )
          .join("\n")
      : "(No concepts yet.)";

  const historyBlock =
    input.chatHistory.length > 0
      ? input.chatHistory
          .map((m) => `${m.role === "user" ? "Student" : "Assistant"}: ${m.content}`)
          .join("\n\n")
      : "(No prior messages.)";

  return `You are an expert CELPIP English instructor helping a student add a new micro-skill concept to their Concept Lab.

Concept Lab concepts are narrow, drillable skills — e.g. "When to use 'to' (and when not to)", "Articles (a, an, the)", "Scanning for dates in Part 2 diagrams". They are NOT broad topics like "grammar" or "reading".

EXISTING CONCEPTS (do not duplicate these — suggest practicing an existing one if the student's idea overlaps):
${conceptsBlock}

Valid categories: grammar, vocabulary, reading_strategy, writing_structure

Your job:
1. Understand what micro-skill the student wants to practice.
2. Ask 1-2 focused clarifying questions if the idea is vague, too broad, or overlaps an existing concept.
3. When you have enough detail, set readyToCreate to true and fill in the concept object.

Rules:
- Be concise and conversational in "reply".
- Only set readyToCreate to true when you are confident about label, category, and description.
- label: short human-readable title (3-8 words).
- description: 1-2 sentences explaining what the student will practice.
- examples: optional array of 1-3 short example sentences or patterns.
- aliases: optional array of phrases graders might use to tag this weakness.
- id: optional snake_case slug; omit it and we will derive one from the label.
- If the student's idea matches an existing concept, say so and do NOT create a duplicate.

CHAT HISTORY:
${historyBlock}

NEW STUDENT MESSAGE:
${input.userMessage}

Return ONLY valid JSON:
{
  "reply": "Your conversational response",
  "readyToCreate": false,
  "concept": null
}

When ready to create, set readyToCreate to true and provide concept:
{
  "reply": "Brief confirmation of what you are adding",
  "readyToCreate": true,
  "concept": {
    "label": "string",
    "category": "grammar|vocabulary|reading_strategy|writing_structure",
    "description": "string",
    "examples": ["optional"],
    "aliases": ["optional"],
    "id": "optional_snake_case"
  }
}`;
}

export function buildConceptFromWritingErrorPrompt(input: {
  existingConcepts: Array<{ label: string; category: string; description: string }>;
  original: string;
  corrected: string;
  reason: string;
  suggestedConceptId?: string;
  suggestedLabel?: string;
}): string {
  const conceptsBlock =
    input.existingConcepts.length > 0
      ? input.existingConcepts
          .map(
            (c, i) =>
              `${i + 1}. ${c.label} (${c.category}) — ${c.description}`,
          )
          .join("\n")
      : "(No concepts yet.)";

  const suggestionBlock = [
    input.suggestedLabel ? `Suggested label: ${input.suggestedLabel}` : null,
    input.suggestedConceptId
      ? `Suggested id slug: ${input.suggestedConceptId}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are an expert CELPIP English instructor. A student made a writing mistake and needs a Concept Lab micro-skill to practice the underlying pattern.

Concept Lab concepts are narrow, drillable skills — NOT broad topics like "grammar".

EXISTING CONCEPTS (if the mistake clearly matches one, set readyToCreate to false, reply with which existing concept to practice, and do NOT create a duplicate):
${conceptsBlock}

WRITING MISTAKE:
- Original: ${input.original}
- Corrected: ${input.corrected}
- Why it is wrong: ${input.reason}
${suggestionBlock ? `\n${suggestionBlock}` : ""}

Your job:
1. Decide if an existing concept already covers this mistake. If yes, readyToCreate=false and name that concept in reply.
2. Otherwise create ONE new concept now (readyToCreate=true). Do not ask follow-up questions.

Rules:
- reply: one short sentence (confirmation or which existing concept to use).
- label: 3-8 words.
- description: 1-2 sentences on what to practice.
- examples: 1-3 short patterns using the student's mistake type when helpful.
- aliases: phrases that might appear in grader feedback for this issue.
- id: snake_case slug; prefer the suggested id when it fits, otherwise derive from label.

Return ONLY valid JSON:
{
  "reply": "string",
  "readyToCreate": false,
  "concept": null,
  "existingConceptId": "seed_or_discovered_id when an existing concept covers this mistake"
}

When creating:
{
  "reply": "Brief confirmation",
  "readyToCreate": true,
  "concept": {
    "label": "string",
    "category": "grammar|vocabulary|reading_strategy|writing_structure",
    "description": "string",
    "examples": ["optional"],
    "aliases": ["optional"],
    "id": "optional_snake_case"
  }
}`;
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
${GRAMMAR_CORRECTIONS_GUIDANCE}
${SKILL_TAGGING_GUIDANCE}
Provide a clean JSON response:
{
  "estimatedBand": 1-12,
  "overallFeedback": "string markdown",
  "positives": ["string"],
  "constructiveCriticism": ["string"],
  "grammarCorrections": [{"original": "str", "corrected": "str", "reason": "str", "conceptId": "seed concept id"}],
  ${SKILL_TAGS_SCHEMA}
}

Every weakness in constructiveCriticism must have a matching weakness skillTag. Do not omit skillTags.
Return ONLY valid JSON, no markdown fences.`;
}

export function buildConceptMcAnnotatePrompt(
  conceptLabel: string,
  drillItemsJson: string,
): string {
  return `You are an expert English instructor reviewing a multiple-choice concept drill set.

Concept: ${conceptLabel}
Drill exercises (with options and correctAnswerIndex): ${drillItemsJson}

For EACH exercise, read the sentence with every option (index 0-3) inserted at the blank.

Return ONLY valid JSON:
{
  "items": [
    {
      "index": 0,
      "acceptableAnswerIndexes": [1]
    }
  ]
}

Rules:
- Include exactly one entry per exercise (indexes 0 through N-1).
- "acceptableAnswerIndexes" must list every option index that is natural and grammatical in that sentence (sorted ascending).
- List only indexes that truly work — do not pad to multiple answers.
- When only one option works, return an array of length 1.
- correctAnswerIndex is the preferred answer but include any other genuinely acceptable indexes too.`;
}

export function buildConceptMcQuestionHintPrompt(
  conceptLabel: string,
  exercisePrompt: string,
  options: string[],
  studentAnswer: string,
  gradingFeedbackConstraints?: string,
): string {
  const feedbackRules =
    gradingFeedbackConstraints?.trim() || DEFAULT_GRADING_FEEDBACK_CONSTRAINTS;

  return `You are an expert English instructor helping a student with a multiple-choice concept drill.

Concept: ${conceptLabel}
Exercise: ${exercisePrompt}
Answer options: ${JSON.stringify(options)}
Student selected: ${studentAnswer}

The student's answer is wrong. Write a helpful hint. Do NOT reveal or quote the correct answer option.

FEEDBACK STYLE (follow strictly):
${feedbackRules}

${CONCEPT_DRILL_HINT_GUIDANCE}

Output only the hint text — no JSON, no labels, no preamble.`;
}

export function buildConceptQuestionCheckStreamPrompt(
  conceptLabel: string,
  prompt: string,
  studentAnswer: string,
  gradingFeedbackConstraints?: string,
): string {
  const feedbackRules =
    gradingFeedbackConstraints?.trim() || DEFAULT_GRADING_FEEDBACK_CONSTRAINTS;

  return `You are an expert English instructor checking one concept drill exercise.

Concept: ${conceptLabel}
Exercise: ${prompt}
Student answer: ${studentAnswer}

FEEDBACK STYLE (follow strictly):
${feedbackRules}

Decide if the student's answer is correct. Accept reasonable synonyms and paraphrases for fill-in-the-blank answers.

If the answer is correct, respond with exactly the single word CORRECT and nothing else.
If the answer is wrong, output only the hint. Do NOT use JSON.

${CONCEPT_DRILL_HINT_GUIDANCE}`;
}

export function buildConceptMcQuestionCheckPrompt(
  conceptLabel: string,
  exercisePrompt: string,
  options: string[],
  studentAnswer: string,
  keyedCorrectAnswer: string,
  gradingFeedbackConstraints?: string,
): string {
  const feedbackRules =
    gradingFeedbackConstraints?.trim() || DEFAULT_GRADING_FEEDBACK_CONSTRAINTS;

  return `You are an expert English instructor checking one multiple-choice concept drill exercise.

Concept: ${conceptLabel}
Exercise: ${exercisePrompt}
Answer options: ${JSON.stringify(options)}
Preferred answer (for grading reference only — do NOT quote this in the hint): ${keyedCorrectAnswer}
Student selected: ${studentAnswer}

FEEDBACK STYLE (follow strictly):
${feedbackRules}

ACCEPTABILITY (follow strictly):
- Read the sentence with each option inserted. List every option index (0-3) that is natural and grammatical.
- Set isCorrect to true if EVERY option the student selected is in that acceptable list (for a single selection, the one choice must be acceptable).
- Set isCorrect to false if any selected option is unacceptable, or if the student selected nothing applicable.
- Always include "acceptableAnswerIndexes" with every working option index (sorted). Use a one-element array when only one option works.

${CONCEPT_DRILL_HINT_GUIDANCE}

Return ONLY valid JSON:
{
  "isCorrect": true,
  "acceptableAnswerIndexes": [0, 3],
  "hint": "only when isCorrect is false — follow HINT QUALITY above"
}`;
}

export function buildConceptQuestionCheckPrompt(
  conceptLabel: string,
  prompt: string,
  studentAnswer: string,
  gradingFeedbackConstraints?: string,
): string {
  const feedbackRules =
    gradingFeedbackConstraints?.trim() || DEFAULT_GRADING_FEEDBACK_CONSTRAINTS;

  return `You are an expert English instructor checking one concept drill exercise.

Concept: ${conceptLabel}
Exercise: ${prompt}
Student answer: ${studentAnswer}

FEEDBACK STYLE (follow strictly):
${feedbackRules}

Decide if the student's answer is correct. Accept reasonable synonyms and paraphrases for fill-in-the-blank answers.

${CONCEPT_DRILL_HINT_GUIDANCE}

Return ONLY valid JSON:
{
  "isCorrect": true,
  "hint": "only when isCorrect is false — follow HINT QUALITY above"
}`;
}

export function buildConceptMcGradingPrompt(
  conceptLabel: string,
  drillItemsJson: string,
  studentAnswersJson: string,
  scoreSummary: string,
  gradingFeedbackConstraints?: string,
): string {
  const feedbackRules =
    gradingFeedbackConstraints?.trim() || DEFAULT_GRADING_FEEDBACK_CONSTRAINTS;

  return `You are an expert English instructor grading a multiple-choice concept drill.

Concept: ${conceptLabel}
Automatic Score: ${scoreSummary}
Drill exercises (with options and correctAnswerIndex): ${drillItemsJson}
Student selected option indexes (0-3 per question): ${studentAnswersJson}

FEEDBACK STYLE (follow strictly):
${feedbackRules}

The score is already computed. Provide JSON:
{
  "estimatedBand": 1-12,
  "overallFeedback": "string markdown — brief summary only (2-3 sentences max)",
  "positives": ["string"],
  "constructiveCriticism": ["string"],
  "grammarCorrections": [],
  "drillResults": [
    {
      "index": 0,
      "isAcceptable": true,
      "feedback": "One or two short sentences in plain language explaining why the correct option is right, or why the student's choice was wrong."
    }
  ],
  "skillTags": []
}

Include exactly one drillResults entry per exercise (indexes 0 through N-1). Focus feedback on the options — refer to option text, not Yes/No.
For each entry, set "isAcceptable" to true if the student's selected option works naturally in the sentence (even when it differs from correctAnswerIndex). Set false only when clearly wrong or unnatural.
For acceptable answers, give brief reinforcement. For unacceptable answers, explain why the preferred option fits in simple terms.
Do NOT set isCorrect, studentAnswer, or correctAnswer — those are computed separately.
Return ONLY valid JSON, no markdown fences.`;
}

export function buildConceptGradingPrompt(
  conceptLabel: string,
  drillResponses: string,
  studentSubmission: string,
  gradingFeedbackConstraints?: string,
): string {
  const feedbackRules =
    gradingFeedbackConstraints?.trim() || DEFAULT_GRADING_FEEDBACK_CONSTRAINTS;

  return `You are an expert English instructor grading a focused concept drill.

Concept: ${conceptLabel}
Drill exercises: ${drillResponses}
Student responses: ${studentSubmission}

FEEDBACK STYLE (follow strictly):
${feedbackRules}

Known concept IDs for skillTags: ${SEED_CONCEPT_IDS}
${GRAMMAR_CORRECTIONS_GUIDANCE}

Grade each drill exercise individually. Provide JSON:
{
  "estimatedBand": 1-12,
  "overallFeedback": "string markdown — brief summary only (2-3 sentences max)",
  "positives": ["string"],
  "constructiveCriticism": ["string"],
  "grammarCorrections": [{"original": "str", "corrected": "str", "reason": "str", "conceptId": "seed concept id"}],
  "drillResults": [
    {
      "index": 0,
      "isCorrect": true,
      "studentAnswer": "what the student wrote",
      "correctAnswer": "the best acceptable answer",
      "feedback": "one or two short sentences in plain language explaining why correct or incorrect"
    }
  ],
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

Include exactly ${questionCount} readingResults entries in the SAME ORDER as the questions (first entry = question 1, index must be 0; last entry index = ${questionCount - 1}). Use zero-based index only — never 1-based.
Each feedback must refer only to that specific question and its four multiple-choice options (A–D). Never use Yes/No, True/False, or boolean correct-answer wording.
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
1. "examPrompt": The reading passage in CELPIP ${part} format (full length, full complexity; GFM markdown only — use markdown tables for schedules/diagrams, never HTML).
2. "readingQuestions": An array of exactly ${questionCount} objects, each with "question", "options" (4 strings), "correctAnswerIndex" (0-3), "celpipPart" = "${part}", "questionType" (one of ${READING_QUESTION_TYPE_IDS.join("/")}), and "targetClbBand" (integer 6-12).
3. "passageCelpipPart": "${part}".
4. "passageTargetClbBand": integer 6-12.

Return ONLY valid JSON, no markdown fences.`;
}

export function buildReadingQuestionChatPrompt(input: {
  examPrompt: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  studentAnswerIndex: number;
  gradingFeedback: string;
  celpipPart?: string;
  questionType?: string;
  userMessage: string;
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>;
}): string {
  const historyBlock =
    input.chatHistory.length > 0
      ? input.chatHistory
          .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
          .join("\n\n")
      : "(No prior messages.)";

  const optionsBlock = input.options
    .map(
      (opt, i) =>
        `${String.fromCharCode(65 + i)}. ${opt}${i === input.correctAnswerIndex ? " (correct)" : i === input.studentAnswerIndex ? " (student chose)" : ""}`,
    )
    .join("\n");

  const metaLines = [
    input.celpipPart ? `CELPIP part: ${input.celpipPart}` : null,
    input.questionType ? `Question type: ${input.questionType}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are an expert CELPIP Reading tutor. The student missed one multiple-choice question and wants help understanding it.

Stay focused on THIS question and the passage below. Do not invent facts beyond the passage. Quote or paraphrase the passage when explaining.

READING PASSAGE:
---
${input.examPrompt}
---

QUESTION:
${input.question}

OPTIONS:
${optionsBlock}

GRADER FEEDBACK (already shown to the student):
${input.gradingFeedback || "(No additional grader notes.)"}
${metaLines ? `\n${metaLines}` : ""}

CHAT HISTORY:
${historyBlock}

NEW STUDENT MESSAGE:
${input.userMessage}

Respond as a supportive tutor:
- Answer the student's specific question clearly and concisely (2-5 short paragraphs max).
- Point to relevant lines or ideas in the passage.
- Explain why the correct option fits and why distractors do not, without being condescending.
- If they ask about test strategy, tie advice to this question type when possible.
- Do not change their score or suggest they were right when they were wrong.

Return ONLY valid JSON:
{
  "reply": "Your response in plain text (markdown allowed for emphasis/lists)"
}`;
}
