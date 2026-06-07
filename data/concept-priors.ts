import { CONCEPT_SEED } from "@/data/concept-seed";

/** Static priors for deterministic focus selection (1 = low, 5 = high). */
export interface ConceptPrior {
  celpipImpact: number;
  examFrequency: number;
  difficulty: number;
}

const DEFAULT_PRIOR: ConceptPrior = {
  celpipImpact: 3,
  examFrequency: 3,
  difficulty: 3,
};

/**
 * Hand-authored CELPIP writing priors. Higher impact/frequency concepts are
 * prioritized when the AI shortlist and error counts are otherwise similar.
 */
const WRITING_PRIORS: Record<string, ConceptPrior> = {
  task_fulfillment: { celpipImpact: 5, examFrequency: 5, difficulty: 3 },
  verb_tenses: { celpipImpact: 5, examFrequency: 5, difficulty: 3 },
  formal_tone_register: { celpipImpact: 4, examFrequency: 5, difficulty: 2 },
  paragraph_structure: { celpipImpact: 4, examFrequency: 4, difficulty: 3 },
  connectors_transitions: { celpipImpact: 4, examFrequency: 4, difficulty: 2 },
  subject_verb_agreement: { celpipImpact: 4, examFrequency: 4, difficulty: 3 },
  articles_a_an_the: { celpipImpact: 4, examFrequency: 4, difficulty: 3 },
  preposition_in_at_on: { celpipImpact: 4, examFrequency: 4, difficulty: 3 },
  vocabulary_precision: { celpipImpact: 4, examFrequency: 4, difficulty: 3 },
  sentence_variety: { celpipImpact: 3, examFrequency: 4, difficulty: 4 },
  infinitive_to_usage: { celpipImpact: 3, examFrequency: 3, difficulty: 3 },
  collocations: { celpipImpact: 3, examFrequency: 3, difficulty: 4 },
  punctuation_mechanics: { celpipImpact: 2, examFrequency: 3, difficulty: 2 },
  skimming_scanning: { celpipImpact: 3, examFrequency: 5, difficulty: 2 },
  distractor_analysis: { celpipImpact: 3, examFrequency: 4, difficulty: 3 },
  inference_implied_meaning: { celpipImpact: 3, examFrequency: 4, difficulty: 4 },
  main_idea_identification: { celpipImpact: 3, examFrequency: 4, difficulty: 2 },
  paraphrase_recognition: { celpipImpact: 3, examFrequency: 4, difficulty: 3 },
};

export function getConceptPrior(conceptId: string): ConceptPrior {
  return WRITING_PRIORS[conceptId] ?? DEFAULT_PRIOR;
}

export function getAllConceptPriors(): Record<string, ConceptPrior> {
  const out: Record<string, ConceptPrior> = {};
  for (const concept of CONCEPT_SEED) {
    out[concept.id] = getConceptPrior(concept.id);
  }
  return out;
}
