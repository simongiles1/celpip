import type {
  VocabularyProgress,
  VocabularyQuestionAnswerState,
  VocabularyWord,
} from "@/lib/types";
import { shuffleVocabularyWords } from "@/lib/vocabulary-shuffle";

export function hydrateVocabularyAnswersByWord(
  progress: VocabularyProgress | undefined,
): Record<number, VocabularyQuestionAnswerState[]> {
  if (!progress?.answersByWord) return {};

  const hydrated: Record<number, VocabularyQuestionAnswerState[]> = {};
  for (const [key, answers] of Object.entries(progress.answersByWord)) {
    hydrated[Number(key)] = answers;
  }
  return hydrated;
}

export function vocabularyProgressHasAnswers(
  progress: VocabularyProgress | undefined,
): boolean {
  if (!progress?.answersByWord) return false;
  return Object.values(progress.answersByWord).some((answers) =>
    answers.some(
      (state) =>
        state.checked ||
        state.selectedIndex != null ||
        (state.selectedIndexes?.length ?? 0) > 0,
    ),
  );
}

/** Shuffle option order for cached sets that predate server-side shuffling. */
export function prepareVocabularyWordsForPractice(
  words: VocabularyWord[],
  seedPrefix: string,
  progress: VocabularyProgress | undefined,
): VocabularyWord[] {
  if (!words.length || vocabularyProgressHasAnswers(progress)) {
    return words;
  }
  return shuffleVocabularyWords(words, seedPrefix);
}

export function serializeVocabularyProgress(
  currentWordIndex: number,
  answersByWord: Record<number, VocabularyQuestionAnswerState[]>,
): VocabularyProgress {
  const serialized: Record<string, VocabularyQuestionAnswerState[]> = {};
  for (const [key, answers] of Object.entries(answersByWord)) {
    serialized[key] = answers;
  }
  return {
    currentWordIndex,
    answersByWord: serialized,
  };
}
