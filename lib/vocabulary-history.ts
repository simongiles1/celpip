import type { GeneratedContent } from "@/lib/types";

export function normalizeVocabularyWordKey(word: string): string {
  return word.trim().toLowerCase();
}

/** Collect unique vocabulary words from prior daily sessions. */
export function collectUsedVocabularyWords(
  generated: GeneratedContent[],
  excludeEventId?: string,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of generated) {
    if (excludeEventId && item.eventId === excludeEventId) continue;
    if (!item.vocabularyWords?.length) continue;

    for (const vocab of item.vocabularyWords) {
      const key = normalizeVocabularyWordKey(vocab.word);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(vocab.word.trim());
    }
  }

  return result;
}

export function findExcludedVocabularyOverlap(
  words: { word: string }[],
  excludeWords: string[],
): string | undefined {
  const excluded = new Set(excludeWords.map(normalizeVocabularyWordKey));
  const batch = new Set<string>();

  for (const word of words) {
    const key = normalizeVocabularyWordKey(word.word);
    if (!key) {
      return "Each vocabulary item must include a non-empty word.";
    }
    if (excluded.has(key)) {
      return `Word "${word.word}" was already used in a prior vocabulary session.`;
    }
    if (batch.has(key)) {
      return `Duplicate word "${word.word}" within the same session.`;
    }
    batch.add(key);
  }

  return undefined;
}
