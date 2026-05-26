import { getConceptDocument } from "@/data/concept-documents";
import { getConceptDrillConstraints } from "@/lib/prompts";
import type {
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

export function upsertConceptCustomization(
  customizations: ConceptCustomization[],
  conceptId: string,
  patch: Partial<Omit<ConceptCustomization, "conceptId">>,
): ConceptCustomization[] {
  const existing = getConceptCustomization(customizations, conceptId);
  const updated: ConceptCustomization = {
    conceptId,
    chatMessages: existing?.chatMessages ?? [],
    instructionMarkdown: existing?.instructionMarkdown,
    drillConstraints: existing?.drillConstraints,
    descriptionOverride: existing?.descriptionOverride,
    updatedAt: new Date().toISOString(),
    ...patch,
  };

  if (existing) {
    return customizations.map((c) => (c.conceptId === conceptId ? updated : c));
  }
  return [...customizations, updated];
}
