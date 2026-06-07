import { getConceptDocument } from "@/data/concept-documents";
import {
  DEFAULT_GRADING_FEEDBACK_CONSTRAINTS,
  getConceptDrillConstraints,
} from "@/lib/prompts";
import type {
  ConceptChatContext,
  ConceptChatMessage,
  ConceptCustomization,
  ConceptDefinition,
} from "@/lib/types";

export function getConceptCustomization(
  customizations: ConceptCustomization[],
  conceptId: string,
): ConceptCustomization | undefined {
  return customizations.find((c) => c.conceptId === conceptId);
}

export function resolveConceptDocument(
  concept: ConceptDefinition,
  customization?: ConceptCustomization,
): string {
  if (customization?.instructionMarkdown?.trim()) {
    return customization.instructionMarkdown;
  }
  return getConceptDocument(concept);
}

export function resolveConceptDescription(
  concept: ConceptDefinition,
  customization?: ConceptCustomization,
): string {
  return customization?.descriptionOverride?.trim() || concept.description;
}

export function resolveDrillConstraints(
  conceptId: string | undefined,
  customization?: ConceptCustomization,
): string {
  if (customization?.drillConstraints?.trim()) {
    return customization.drillConstraints;
  }
  return getConceptDrillConstraints(conceptId);
}

export function resolveGradingFeedbackConstraints(
  customization?: ConceptCustomization,
): string {
  if (customization?.gradingFeedbackConstraints?.trim()) {
    return customization.gradingFeedbackConstraints;
  }
  return DEFAULT_GRADING_FEEDBACK_CONSTRAINTS;
}

export function getConceptChatMessages(
  customization: ConceptCustomization | undefined,
  context: ConceptChatContext,
): ConceptChatMessage[] {
  if (context === "instructions") {
    return (
      customization?.instructionChatMessages ??
      customization?.chatMessages ??
      []
    );
  }
  return customization?.exerciseChatMessages ?? [];
}

export function upsertConceptCustomization(
  customizations: ConceptCustomization[],
  conceptId: string,
  patch: Partial<Omit<ConceptCustomization, "conceptId">>,
): ConceptCustomization[] {
  const existing = getConceptCustomization(customizations, conceptId);
  const updated: ConceptCustomization = {
    conceptId,
    instructionChatMessages:
      existing?.instructionChatMessages ??
      existing?.chatMessages ??
      [],
    exerciseChatMessages: existing?.exerciseChatMessages ?? [],
    instructionMarkdown: existing?.instructionMarkdown,
    drillConstraints: existing?.drillConstraints,
    gradingFeedbackConstraints: existing?.gradingFeedbackConstraints,
    descriptionOverride: existing?.descriptionOverride,
    updatedAt: new Date().toISOString(),
    ...patch,
  };

  if (existing) {
    return customizations.map((c) => (c.conceptId === conceptId ? updated : c));
  }
  return [...customizations, updated];
}
