import { z } from "zod";
import type { VocabularyWord } from "@/lib/types";

const vocabularyQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("definition_choice"),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).length(4),
    correctAnswerIndex: z.number().int().min(0).max(3),
    explanation: z.string().min(1),
  }),
  z.object({
    type: z.literal("synonym_choice"),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).length(4),
    correctAnswerIndex: z.number().int().min(0).max(3),
    explanation: z.string().min(1),
  }),
  z.object({
    type: z.literal("word_fit_select"),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).length(5),
    correctAnswerIndexes: z
      .array(z.number().int().min(0).max(4))
      .min(2)
      .max(3)
      .refine((indexes) => new Set(indexes).size === indexes.length, {
        message: "correctAnswerIndexes must be unique",
      }),
    explanation: z.string().min(1),
  }),
]);

export const vocabularyWordSchema = z.object({
  word: z.string().min(1),
  partOfSpeech: z.string().min(1),
  definition: z.string().min(1),
  exampleSentence: z.string().min(1),
  writingTip: z.string().min(1),
  spokenAlternative: z.string().optional(),
  questions: z.array(vocabularyQuestionSchema).length(3),
});

export const vocabularyResponseSchema = z.object({
  words: z.array(vocabularyWordSchema).min(1),
});

export type ParsedVocabularyWord = z.infer<typeof vocabularyWordSchema>;
export type ParsedVocabularyQuestion = z.infer<typeof vocabularyQuestionSchema>;

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function tokensFromText(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9'-]+/)
    .filter((token) => token.length > 2);
}

function explanationContainsOption(
  explanation: string,
  option: string,
): boolean {
  const optionLower = option.trim().toLowerCase();
  if (optionLower.length < 3) return false;

  const explanationLower = explanation.toLowerCase();
  if (explanationLower.includes(optionLower)) return true;

  return tokensFromText(explanation).includes(optionLower);
}

function getQuestionOptions(question: ParsedVocabularyQuestion): string[] {
  if (question.type === "definition_choice" || question.type === "synonym_choice") {
    return question.options;
  }
  return question.options;
}

function getCorrectOptionTexts(question: ParsedVocabularyQuestion): string[] {
  if (question.type === "word_fit_select") {
    return question.correctAnswerIndexes.map(
      (index) => question.options[index],
    );
  }
  if (question.type === "definition_choice" || question.type === "synonym_choice") {
    return [question.options[question.correctAnswerIndex]];
  }
  return [];
}

function validateSingleWord(word: ParsedVocabularyWord): string | undefined {
  const types = word.questions.map((question) => question.type).sort();
  const expected = [
    "definition_choice",
    "synonym_choice",
    "word_fit_select",
  ].sort();
  if (types.join(",") !== expected.join(",")) {
    return `Word "${word.word}" must include one definition_choice, one word_fit_select, and one synonym_choice question.`;
  }

  const wordFit = word.questions.find(
    (question) => question.type === "word_fit_select",
  );
  if (wordFit) {
    for (const index of wordFit.correctAnswerIndexes) {
      const option = wordFit.options[index];
      if (normalizeToken(option) === normalizeToken(word.word)) {
        return `Word "${word.word}": word_fit_select must not include the target word in options.`;
      }
    }
  }

  for (let index = 0; index < word.questions.length; index += 1) {
    const question = word.questions[index];
    const otherQuestions = word.questions.filter((_, i) => i !== index);

    const otherOptions = otherQuestions.flatMap(getQuestionOptions);
    const otherCorrectAnswers = otherQuestions.flatMap(getCorrectOptionTexts);

    for (const option of otherOptions) {
      if (explanationContainsOption(question.explanation, option)) {
        return `Word "${word.word}": the ${question.type} explanation must not mention "${option}" because it appears in another question's options.`;
      }
    }

    for (const answer of otherCorrectAnswers) {
      if (explanationContainsOption(question.explanation, answer)) {
        return `Word "${word.word}": the ${question.type} explanation must not mention "${answer}" because it is a correct answer to another question.`;
      }
    }
  }

  return undefined;
}

export function validateWordQuestions(value: unknown): string | undefined {
  const result = vocabularyResponseSchema.safeParse(value);
  if (!result.success) return result.error.message;

  for (const word of result.data.words) {
    const wordError = validateSingleWord(word);
    if (wordError) return wordError;
  }

  return undefined;
}

export function isValidVocabularyWord(word: VocabularyWord): boolean {
  const parsed = vocabularyWordSchema.safeParse(word);
  if (!parsed.success) return false;
  return validateSingleWord(parsed.data) === undefined;
}

export function hasValidVocabularyPractice(words: VocabularyWord[]): boolean {
  return words.length > 0 && words.every(isValidVocabularyWord);
}

function setsEqual(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort((a, b) => a - b);
  const sortedRight = [...right].sort((a, b) => a - b);
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

export function isMultiSelectAnswerCorrect(
  selectedIndexes: number[],
  correctIndexes: number[],
): boolean {
  return setsEqual(selectedIndexes, correctIndexes);
}
