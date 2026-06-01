import type { VocabularyQuestion, VocabularyWord } from "@/lib/types";

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates order: result[i] = original index now shown at position i. */
function shuffledOriginalIndexes(length: number, random: () => number): number[] {
  const order = Array.from({ length }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function remapCorrectIndex(
  originalIndex: number,
  displayOrder: number[],
): number {
  return displayOrder.indexOf(originalIndex);
}

function remapCorrectIndexes(
  originalIndexes: number[],
  displayOrder: number[],
): number[] {
  return originalIndexes
    .map((index) => remapCorrectIndex(index, displayOrder))
    .sort((a, b) => a - b);
}

export function shuffleVocabularyQuestion(
  question: VocabularyQuestion,
  seed: string,
): VocabularyQuestion {
  if (!question.options?.length) return question;

  const displayOrder = shuffledOriginalIndexes(
    question.options.length,
    createSeededRandom(seed),
  );
  const shuffledOptions = displayOrder.map(
    (originalIndex) => question.options![originalIndex],
  );

  if (question.type === "word_fit_select") {
    return {
      ...question,
      options: shuffledOptions,
      correctAnswerIndexes: remapCorrectIndexes(
        question.correctAnswerIndexes ?? [],
        displayOrder,
      ),
    };
  }

  if (
    question.correctAnswerIndex == null ||
    question.correctAnswerIndex < 0
  ) {
    return { ...question, options: shuffledOptions };
  }

  return {
    ...question,
    options: shuffledOptions,
    correctAnswerIndex: remapCorrectIndex(
      question.correctAnswerIndex,
      displayOrder,
    ),
  };
}

export function shuffleVocabularyWord(
  word: VocabularyWord,
  seedPrefix: string,
): VocabularyWord {
  if (!word.questions?.length) return word;

  return {
    ...word,
    questions: word.questions.map((question) =>
      shuffleVocabularyQuestion(
        question,
        `${seedPrefix}:${word.word}:${question.type}`,
      ),
    ),
  };
}

export function shuffleVocabularyWords(
  words: VocabularyWord[],
  seedPrefix: string,
): VocabularyWord[] {
  return words.map((word) => shuffleVocabularyWord(word, seedPrefix));
}
