export function buildVocabularyPrompt(
  wordCount: number,
  sessionDate: string,
  excludeWords: string[] = [],
): string {
  const exclusionBlock =
    excludeWords.length > 0
      ? `
Previously used words — do NOT reuse any of these (including close variants, plural forms, or the same root with a different suffix):
${excludeWords.map((word) => `- ${word}`).join("\n")}

Every word in your response must be completely new and must not appear in the list above.
`
      : "";

  return `You are a CELPIP writing coach. Generate exactly ${wordCount} vocabulary items for a daily study session.

Target: CLB 9 (Canadian Language Benchmark 9) — the level needed for strong CELPIP writing scores.

Learner profile:
- Speaks English comfortably but writes with simpler, spoken vocabulary.
- Needs formal written alternatives, collocations, and precise word choice for CELPIP Task 1 (email) and Task 2 (survey response).
- Canadian English register; neutral-to-formal tone.

Session date seed (vary word themes by date — do not repeat generic lists): ${sessionDate}
${exclusionBlock}
Requirements for each word:
1. "word" — a useful CLB-9-level word or short phrase (1-3 words max) for formal writing.
2. "partOfSpeech" — e.g. verb, noun, adjective, collocation.
3. "definition" — clear, concise definition in plain English.
4. "exampleSentence" — one sentence showing natural use in a CELPIP-style email or survey response (workplace, community, or daily-life Canada context).
5. "writingTip" — one sentence explaining why this word elevates writing vs everyday speech.
6. "spokenAlternative" (optional but strongly preferred) — the informal word the learner might write instead (e.g. "get" → "obtain").
7. "questions" — exactly 3 practice questions for THIS word:
   a) "definition_choice" — ask for the best definition of the word. Provide exactly 4 plausible options; only one is correct.
   b) "word_fit_select" — see word_fit_select rules below.
   c) "synonym_choice" — ask which option is closest in meaning to the target word in formal writing. Provide exactly 4 options (one correct synonym or near-synonym; distractors should be plausible but wrong).

IMPORTANT — how the learner sees these questions:
- The target word is displayed at the top of the screen for the entire practice set.
- All 3 questions appear on the same page; the learner answers them in order.
- After each answer, your "explanation" is shown immediately — while the other questions may still be unanswered.
- Therefore explanations must NEVER give away answers to the other two questions.

word_fit_select rules (CRITICAL — replaces free-text fill-in-the-blank):
- Prompt: a short CELPIP-style sentence with ___ where a simpler or related word could go, plus the instruction "Check all words that could fit the blank."
- Provide exactly 5 single-word options.
- Mark exactly 2 or 3 options as correct via "correctAnswerIndexes" (0-4). Every correct option must genuinely fit the sentence in everyday/informal writing.
- The remaining 2-3 options must clearly NOT fit (wrong meaning or wrong grammar).
- Include spokenAlternative as one of the correct options when provided.
- Other correct options should be reasonable everyday synonyms that fit the sentence — not only one narrow answer.
- Do NOT include the target formal word in the options (it is visible in the app header).
- Example for target "endeavour", spokenAlternative "try": prompt "Before using formal vocabulary, you might write that you will ___ to resolve the issue."; options ["delay", "try", "ignore", "attempt", "strive"]; correctAnswerIndexes [1, 3, 4] (correct answers must NOT cluster at the start or end of the list).

Explanation rules (CRITICAL — cross-question leakage):
- Each explanation is one short sentence shown right after that question is answered.
- Do NOT include any word or phrase that appears in another question's options for the same word.
- Do NOT name the correct answer(s) to another question.
- Do NOT restate the definition using near-synonyms that appear in the synonym_choice options.
- definition_choice explanation: confirm in general terms only — no synonym lists, no words from other question options.
- word_fit_select explanation: explain the idea (everyday vs formal) without naming specific options from synonym_choice or definition_choice.
- synonym_choice explanation: explain register or nuance — do not repeat definition wording or name words from other question options.
- Before finalizing each word, cross-check all three explanations against all options across all three questions; remove overlapping vocabulary.

General question rules:
- Each question needs "type", "prompt", and "explanation".
- definition_choice and synonym_choice need "options" (4 strings) and "correctAnswerIndex" (0-3).
- word_fit_select needs "options" (5 strings) and "correctAnswerIndexes" (array of 2-3 distinct indexes).
- Vary correctAnswerIndex and correctAnswerIndexes across questions and words — never default every word to index 0 for definition_choice, [0,1,2] for word_fit_select, and 1 for synonym_choice.
- Do not repeat the same distractors across the three questions for one word.
- definition_choice options should be full definitions, not single-word synonyms (leave synonyms for synonym_choice and word_fit_select).

Cover a mix across sessions: formal verbs, precise adjectives, transition phrases, collocations, and opinion/support vocabulary.

Return ONLY valid JSON:
{
  "words": [
    {
      "word": "...",
      "partOfSpeech": "...",
      "definition": "...",
      "exampleSentence": "...",
      "writingTip": "...",
      "spokenAlternative": "...",
      "questions": [
        {
          "type": "definition_choice",
          "prompt": "...",
          "options": ["...", "...", "...", "..."],
          "correctAnswerIndex": 2,
          "explanation": "..."
        },
        {
          "type": "word_fit_select",
          "prompt": "Check all words that could fit the blank: \"... ___ ...\"",
          "options": ["...", "...", "...", "...", "..."],
          "correctAnswerIndexes": [1, 3, 4],
          "explanation": "..."
        },
        {
          "type": "synonym_choice",
          "prompt": "...",
          "options": ["...", "...", "...", "..."],
          "correctAnswerIndex": 3,
          "explanation": "..."
        }
      ]
    }
  ]
}`;
}
