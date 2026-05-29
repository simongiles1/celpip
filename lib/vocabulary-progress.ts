import type {
  VocabularyProgress,
  VocabularyQuestionAnswerState,
} from "@/lib/types";

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
