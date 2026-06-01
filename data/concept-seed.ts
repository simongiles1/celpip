import type { ConceptDefinition } from "@/lib/types";

export const CONCEPT_SEED: ConceptDefinition[] = [
  {
    id: "preposition_in_at_on",
    label: "In, at, and on (time & place)",
    category: "grammar",
    description:
      "Choose the correct preposition for locations and times (e.g. at the office, on Monday, in March).",
    examples: ["I am at the office.", "The meeting is on Monday.", "She lives in Toronto."],
    source: "seed",
    aliases: ["preposition errors", "in/at/on", "prepositions of time", "prepositions of place"],
  },
  {
    id: "infinitive_to_usage",
    label: "When to use 'to' (and when not to)",
    category: "grammar",
    description:
      "Use 'to' after verbs of movement toward a place (go, walk, drive), but not after enter, arrive, reach, or visit (e.g. go to the store vs enter the building). This is not about choosing at/in/on.",
    examples: ["I go to the store.", "I enter the building.", "She arrived at the airport."],
    source: "seed",
    aliases: ["to infinitive", "enter to", "go to vs enter", "missing to", "extra to"],
  },
  {
    id: "articles_a_an_the",
    label: "Articles (a, an, the)",
    category: "grammar",
    description:
      "Use a/an for first mention or general reference, the for specific or known nouns, and zero article where appropriate in formal writing.",
    examples: ["I received an email.", "The manager approved the request.", "We need feedback by Friday."],
    source: "seed",
    aliases: ["article errors", "a/an/the", "missing article", "wrong article"],
  },
  {
    id: "subject_verb_agreement",
    label: "Subject-verb agreement",
    category: "grammar",
    description:
      "Match singular and plural subjects with the correct verb form, including traps with there is/are, prepositional phrases, and indefinite pronouns.",
    examples: [
      "The list of options is long.",
      "There are several issues to resolve.",
      "Each of the reports has been reviewed.",
    ],
    source: "seed",
    aliases: ["verb agreement", "subject verb agreement", "singular plural verb"],
  },
  {
    id: "verb_tenses",
    label: "Verb tenses and consistency",
    category: "grammar",
    description:
      "Choose appropriate tenses (past, present, present perfect) and keep the timeline consistent within a response.",
    examples: [
      "I submitted the form yesterday.",
      "I have attached the document.",
      "Last week I wrote to HR and explained the issue.",
    ],
    source: "seed",
    aliases: ["tense errors", "past tense", "present perfect", "tense consistency"],
  },
  {
    id: "connectors_transitions",
    label: "Connectors and transitions",
    category: "writing_structure",
    description:
      "Use formal linking words (however, therefore, furthermore) that match the logical relationship between ideas.",
    examples: [
      "The cost is high; however, the quality is excellent.",
      "The files were incomplete; therefore, we delayed approval.",
      "The plan is feasible; furthermore, it is affordable.",
    ],
    source: "seed",
    aliases: ["transitions", "linking words", "connectors", "cohesive devices"],
  },
  {
    id: "formal_tone_register",
    label: "Formal tone and register",
    category: "writing_structure",
    description:
      "Use polite, professional language in CELPIP emails and survey responses—avoid slang, blunt requests, and overly casual phrasing.",
    examples: [
      "Dear Ms. Patel, I am writing to report an issue with the heating system.",
      "Could you please confirm whether the documents have been received?",
      "Thank you for your assistance.",
    ],
    source: "seed",
    aliases: ["informal tone", "register", "formality", "too casual"],
  },
  {
    id: "paragraph_structure",
    label: "Paragraph structure (PEEL/PEER)",
    category: "writing_structure",
    description:
      "Organize each paragraph with a clear point, supporting evidence or example, explanation, and link back to the task.",
    examples: [
      "Option A reduces commute time for most staff.",
      "The new schedule starts at 10 a.m., avoiding peak traffic.",
      "For these reasons, Option A better meets employees' needs.",
    ],
    source: "seed",
    aliases: ["organization", "paragraph cohesion", "PEEL", "PEER", "structure"],
  },
  {
    id: "task_fulfillment",
    label: "Task fulfillment",
    category: "writing_structure",
    description:
      "Address every part of the prompt (all email bullets or a clear survey choice with reasons) with relevant, complete content.",
    examples: [
      "Explain the delay, apologize, and propose a new meeting time.",
      "State your survey choice in the opening paragraph.",
      "Give at least one sentence per bullet point.",
    ],
    source: "seed",
    aliases: ["incomplete response", "off topic", "missing points", "task fulfillment"],
  },
  {
    id: "vocabulary_precision",
    label: "Vocabulary precision",
    category: "vocabulary",
    description:
      "Replace vague or informal words (good, thing, get) with specific, formal alternatives suited to workplace writing.",
    examples: [
      "We received an unsatisfactory outcome.",
      "The policy offers a clear advantage.",
      "Please submit the documentation by Friday.",
    ],
    source: "seed",
    aliases: ["word choice", "vocabulary range", "repetitive words", "vague language"],
  },
  {
    id: "collocations",
    label: "Collocations and phrasal verbs",
    category: "vocabulary",
    description:
      "Use natural word combinations (make a decision) and formal alternatives to casual phrasal verbs where appropriate.",
    examples: [
      "We need to make a decision by Friday.",
      "Please comply with the regulations.",
      "We will postpone the meeting.",
    ],
    source: "seed",
    aliases: ["collocation", "phrasal verb", "unnatural phrase"],
  },
  {
    id: "skimming_scanning",
    label: "Skimming and scanning",
    category: "reading_strategy",
    description:
      "Skim for gist and structure; scan for specific facts (dates, names, labels) without reading every word under time pressure.",
    examples: [
      "Read the title and first sentence of each section before answering.",
      "Scan a diagram for times and room numbers.",
      "Match statements to paragraphs by keyword, not identical wording.",
    ],
    source: "seed",
    aliases: ["reading speed", "skim", "scan", "time management reading"],
  },
  {
    id: "distractor_analysis",
    label: "Distractor analysis",
    category: "reading_strategy",
    description:
      "Eliminate wrong answers by checking scope, polarity, and exact wording against the passage—not what sounds plausible alone.",
    examples: [
      "Most participants preferred the morning session (not all).",
      "Cross out options that contradict the passage.",
      "Watch for except, not, and least in the question stem.",
    ],
    source: "seed",
    aliases: ["wrong option", "distractor", "trap answer", "misleading option"],
  },
  {
    id: "inference_implied_meaning",
    label: "Inference and implied meaning",
    category: "reading_strategy",
    description:
      "Draw supported conclusions from tone, contrast, and context—without adding facts not in the passage.",
    examples: [
      "Negative adjectives may imply the author is critical.",
      "However signals a limitation or disagreement.",
      "Might vs must changes the strength of a claim.",
    ],
    source: "seed",
    aliases: ["inference", "implied meaning", "reading between the lines"],
  },
  {
    id: "main_idea_identification",
    label: "Main idea identification",
    category: "reading_strategy",
    description:
      "Identify what the passage or paragraph is mostly about, not a single minor detail or an overly broad theme.",
    examples: [
      "Reasons for a fare increase, not one bus route number.",
      "Use the title and opening paragraph to predict the gist.",
      "Reject options that are too narrow or too broad.",
    ],
    source: "seed",
    aliases: ["main idea", "central theme", "gist"],
  },
  {
    id: "paraphrase_recognition",
    label: "Paraphrase recognition",
    category: "reading_strategy",
    description:
      "Recognize when a question option restates the same meaning as the passage using different words or grammar.",
    examples: [
      "reduce costs → lower expenses",
      "not mandatory → optional",
      "must submit → required to provide",
    ],
    source: "seed",
    aliases: ["synonym", "paraphrasing", "reworded", "same meaning different words"],
  },
  {
    id: "punctuation_mechanics",
    label: "Punctuation and mechanics",
    category: "grammar",
    description:
      "Fix comma splices, run-ons, and apostrophe errors; use commas and semicolons to show clause relationships.",
    examples: [
      "The report is complete; please send it to the committee.",
      "It's ready (it is) vs its policy (possession).",
      "Although traffic was heavy, I arrived on time.",
    ],
    source: "seed",
    aliases: ["punctuation", "comma splice", "run-on sentence", "apostrophe"],
  },
  {
    id: "sentence_variety",
    label: "Sentence variety and complexity",
    category: "writing_structure",
    description:
      "Mix simple, compound, and complex sentences (because, although, if) for clearer, higher-band writing.",
    examples: [
      "Although traffic was heavy, I arrived on time.",
      "The meeting starts at noon, and lunch will follow.",
      "Could you please clarify which sections are mandatory?",
    ],
    source: "seed",
    aliases: ["sentence variety", "complex sentences", "repetitive structure"],
  },
];

export function getSeedConcept(id: string): ConceptDefinition | undefined {
  return CONCEPT_SEED.find((c) => c.id === id);
}
