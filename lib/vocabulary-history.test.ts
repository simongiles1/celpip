import { describe, expect, it } from "vitest";
import {
  collectUsedVocabularyWords,
  findExcludedVocabularyOverlap,
  normalizeVocabularyWordKey,
} from "@/lib/vocabulary-history";
import type { GeneratedContent } from "@/lib/types";

function vocabGenerated(
  eventId: string,
  words: string[],
): GeneratedContent {
  return {
    eventId,
    instructions: "",
    example: "",
    examPrompt: "",
    vocabularyWords: words.map((word) => ({
      word,
      partOfSpeech: "verb",
      definition: "def",
      exampleSentence: "ex",
      writingTip: "tip",
    })),
    generatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("normalizeVocabularyWordKey", () => {
  it("trims and lowercases", () => {
    expect(normalizeVocabularyWordKey("  Endeavour ")).toBe("endeavour");
  });
});

describe("collectUsedVocabularyWords", () => {
  it("returns unique words across sessions", () => {
    const generated = [
      vocabGenerated("evt-1", ["endeavour", "obtain"]),
      vocabGenerated("evt-2", ["obtain", "facilitate"]),
    ];

    expect(collectUsedVocabularyWords(generated)).toEqual([
      "endeavour",
      "obtain",
      "facilitate",
    ]);
  });

  it("skips the excluded event", () => {
    const generated = [
      vocabGenerated("evt-1", ["endeavour"]),
      vocabGenerated("evt-2", ["facilitate"]),
    ];

    expect(collectUsedVocabularyWords(generated, "evt-2")).toEqual([
      "endeavour",
    ]);
  });
});

describe("findExcludedVocabularyOverlap", () => {
  it("flags overlap with prior words", () => {
    const error = findExcludedVocabularyOverlap(
      [{ word: "Obtain" }],
      ["obtain"],
    );
    expect(error).toMatch(/prior vocabulary session/i);
  });

  it("flags duplicates within the same batch", () => {
    const error = findExcludedVocabularyOverlap(
      [{ word: "obtain" }, { word: " Obtain " }],
      [],
    );
    expect(error).toMatch(/duplicate word/i);
  });
});
