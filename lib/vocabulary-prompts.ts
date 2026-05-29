export function buildVocabularyPrompt(
  wordCount: number,
  sessionDate: string,
): string {
  return `You are a CELPIP writing coach. Generate exactly ${wordCount} vocabulary items for a daily study session.

Target: CLB 9 (Canadian Language Benchmark 9) — the level needed for strong CELPIP writing scores.

Learner profile:
- Speaks English comfortably but writes with simpler, spoken vocabulary.
- Needs formal written alternatives, collocations, and precise word choice for CELPIP Task 1 (email) and Task 2 (survey response).
- Canadian English register; neutral-to-formal tone.

Session date seed (vary word themes by date — do not repeat generic lists): ${sessionDate}

Requirements for each word:
1. "word" — a useful CLB-9-level word or short phrase (1-3 words max) for formal writing.
2. "partOfSpeech" — e.g. verb, noun, adjective, collocation.
3. "definition" — clear, concise definition in plain English.
4. "exampleSentence" — one sentence showing natural use in a CELPIP-style email or survey response (workplace, community, or daily-life Canada context).
5. "writingTip" — one sentence explaining why this word elevates writing vs everyday speech.
6. "spokenAlternative" (optional) — the informal word the learner might write instead (e.g. "get" → "obtain").

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
      "spokenAlternative": "..."
    }
  ]
}`;
}
