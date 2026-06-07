import { getAllConceptPriors } from "@/data/concept-priors";
import type { ConceptContext } from "@/lib/types";

const GRAMMAR_CORRECTIONS_GUIDANCE = `
For each grammarCorrections entry, write "reason" as 2-3 short sentences for an English learner.
- "original" must be an exact verbatim substring copied from the student submission.
- Include "conceptId" on every entry.
Include up to 8 grammarCorrections for substantive errors.`;

const SKILL_TAGGING_GUIDANCE = `
SKILL TAGGING (required):
- Include one skillTag for each distinct weakness (minimum 1, maximum 8). Add up to 3 strength tags.
- Use polarity "weakness" for areas to improve and "strength" for positives.
- Each weakness tag's "evidence" must quote or closely paraphrase a specific phrase from the student submission.`;

export function buildFocusRankPrompt(
  weaknesses: Array<{ conceptId: string; label: string; evidence: string }>,
): string {
  const priors = getAllConceptPriors();
  const priorLines = Object.entries(priors)
    .map(
      ([id, p]) =>
        `${id}: impact=${p.celpipImpact}, frequency=${p.examFrequency}, difficulty=${p.difficulty}`,
    )
    .join("\n");

  const weaknessLines = weaknesses
    .map(
      (w) =>
        `- ${w.conceptId} (${w.label}): "${w.evidence}"`,
    )
    .join("\n");

  return `You are a CELPIP writing coach selecting the lowest-hanging fruit for focused practice.

The student made these writing weaknesses in their latest assessment:
${weaknessLines || "(none listed)"}

Static concept priors (impact/frequency/difficulty on 1-5 scale):
${priorLines}

Rank ALL weakness concepts by "bang for buck" — which 2-3 fixes will raise the CELPIP writing score the most with the least effort. Deprioritize rare exam issues (e.g. semicolon usage) even if the student made that mistake.

Return JSON:
{
  "focusRankings": [
    {
      "conceptId": "seed concept id",
      "estimatedScoreImpact": 1-5,
      "estimatedEffort": 1-5,
      "rationale": "1-2 sentences explaining why this is or is not low-hanging fruit for CELPIP writing"
    }
  ]
}

Include one entry per distinct weakness conceptId. Order from best bang-for-buck to worst.
Return ONLY valid JSON, no markdown fences.`;
}

export function buildFocusedWritingPrompt(
  task: "task_1" | "task_2",
  focusConcepts: ConceptContext[],
): string {
  const focusLines = focusConcepts
    .map(
      (c) =>
        `- ${c.label}${c.evidence ? ` (recent issue: ${c.evidence})` : ""}`,
    )
    .join("\n");

  const taskHint =
    task === "task_1"
      ? `CELPIP Task 1 — Email: realistic email scenario with recipient, reason for writing, and exactly three bullet points. Target 150-200 words.`
      : `CELPIP Task 2 — Survey Opinion: survey question with two labelled options; student picks one and defends it. Target 150-200 words.`;

  return `You are an expert CELPIP instructor building a FOCUSED ASSESSMENT writing exercise.

This is NOT a themed tutorial exercise. It should resemble an official CELPIP writing prompt used to assess the student's current ability.

${taskHint}

The student is currently working on these concepts (bias the scenario so these patterns naturally arise, but keep the prompt realistic):
${focusLines || "(no specific focus — use a standard workplace scenario)"}

Provide JSON with these exact keys:
1. "instructions": Brief markdown (2-3 sentences) explaining this is a focused assessment — write as you would on test day. GFM markdown only.
2. "example": Empty string "" (no example for assessments).
3. "examPrompt": The CELPIP-style writing prompt (GFM markdown only).

Return ONLY valid JSON, no markdown fences.`;
}

export function buildFocusedGradingPrompt(
  examPrompt: string,
  studentSubmission: string,
  focusConceptIds: string[],
  isInitialAssessment: boolean,
): string {
  const focusList =
    focusConceptIds.length > 0
      ? focusConceptIds.join(", ")
      : "(none — initial assessment)";

  const focusHighlightGuidance =
    focusConceptIds.length > 0
      ? `
FOCUS HIGHLIGHTS (required when focus concepts are set):
- For EACH active focus concept (${focusList}), add focusHighlights entries for BOTH:
  1. Correct usages the student demonstrated (polarity "correct") — quote exact substrings.
  2. Mistakes linked to that concept (polarity "mistake") — quote exact substrings.
- "text" must be an exact verbatim substring from the student submission for inline highlighting.
- Non-focus mistakes still go in grammarCorrections (do not duplicate in focusHighlights unless they are focus concepts).`
      : "";

  const rankGuidance = isInitialAssessment
    ? `
FOCUS RANKINGS (required for initial assessment):
After grading, rank every distinct weakness concept by bang-for-buck for CELPIP writing score improvement.
Include focusRankings with conceptId, estimatedScoreImpact (1-5), estimatedEffort (1-5), and rationale.`
    : `
FOCUS RANKINGS (required after focused practice):
Rank remaining weakness concepts (exclude graduated focus concepts) for the next practice cycle.
Include focusRankings with conceptId, estimatedScoreImpact (1-5), estimatedEffort (1-5), and rationale.`;

  return `You are an authorized CELPIP Test Grader running a FOCUSED MASTERY assessment.

Target Assignment: ${examPrompt}
Student Work Submitted: ${studentSubmission}
Active focus concepts: ${focusList}

Evaluate across: Task Fulfillment, Organization/Coherence, Vocabulary, and Sentence Variety/Grammar.
${GRAMMAR_CORRECTIONS_GUIDANCE}
${SKILL_TAGGING_GUIDANCE}
${focusHighlightGuidance}
${rankGuidance}

Provide JSON:
{
  "estimatedBand": 1-12,
  "overallFeedback": "string markdown",
  "positives": ["string"],
  "constructiveCriticism": ["string"],
  "grammarCorrections": [{"original": "str", "corrected": "str", "reason": "str", "conceptId": "seed concept id"}],
  "skillTags": [{"conceptId": "...", "polarity": "strength|weakness", "evidence": "..."}],
  "focusHighlights": [
    {"text": "exact substring", "conceptId": "...", "polarity": "correct|mistake", "note": "brief explanation"}
  ],
  "focusRankings": [
    {"conceptId": "...", "estimatedScoreImpact": 1-5, "estimatedEffort": 1-5, "rationale": "..."}
  ]
}

Every weakness in constructiveCriticism must have a matching weakness skillTag.
Return ONLY valid JSON, no markdown fences.`;
}

export function buildFocusedTestSubmissionPrompt(
  examPrompt: string,
  task: "task_1" | "task_2",
  focusConcepts: ConceptContext[],
): string {
  const focusLines = focusConcepts
    .map(
      (c) =>
        `- ${c.id}: ${c.label}${c.evidence ? ` — ${c.evidence}` : ""}`,
    )
    .join("\n");

  const mistakeGuidance =
    focusConcepts.length > 0
      ? `The writer is practising these focus concepts. Include intentional mistakes for EACH focus concept (at least 1–2 clear errors per concept). Also include 1–2 correct usages of a focus concept so grading can detect strengths. Add 1–2 additional mistakes outside the focus set (different concepts).
Focus concepts:
${focusLines}`
      : `This is an initial assessment with no active focus set yet. Include intentional mistakes spanning 5–7 DIFFERENT common CELPIP writing concepts (e.g. verb_tenses, articles_a_an_the, task_fulfillment, formal_tone_register, connectors_transitions, subject_verb_agreement, vocabulary_precision). Spread errors naturally — do not cluster every mistake in one sentence.`;

  const taskHint =
    task === "task_1"
      ? "Write a CELPIP Task 1 email response."
      : "Write a CELPIP Task 2 survey opinion response.";

  return `You are simulating a CELPIP writing candidate at roughly CLB 7–8 level for developer testing.

${taskHint}
Address the prompt below, but deliberately include realistic learner errors (grammar, tone, structure, task gaps) — NOT typos or nonsense. The response must still read like a real student attempt.

PROMPT:
${examPrompt}

${mistakeGuidance}

Rules:
- 150–200 words.
- Plain text only — no markdown, bullets as sentences if needed for email bullets.
- Mistakes must be plausible ESL errors, not joke errors.
- Still attempt to address the prompt (partial task fulfillment is OK).
- Do NOT explain the mistakes; output only the student draft.

Return JSON:
{
  "studentSubmission": "the full student response as a single string"
}

Return ONLY valid JSON, no markdown fences.`;
}
