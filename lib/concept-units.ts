import { getConceptById } from "@/lib/skill-profile";
import type { CurriculumUnit, UserSkillProfile } from "@/lib/types";

export const CONCEPT_UNIT_PREFIX = "concept-unit-";

export function isConceptUnitId(id: string): boolean {
  return id.startsWith(CONCEPT_UNIT_PREFIX);
}

export function buildConceptUnit(
  conceptId: string,
  profile: UserSkillProfile,
): CurriculumUnit | undefined {
  const concept = getConceptById(profile, conceptId);
  if (!concept) return undefined;

  return {
    id: `${CONCEPT_UNIT_PREFIX}${conceptId}`,
    week: 1,
    dayLabel: "Drill",
    focusSubTest: "Concept",
    focusTarget: concept.label,
    practiceType: "Concept Drill",
    sessionGoal: `Improve ${concept.label}`,
    grammarFocus: concept.description,
    strategy: concept.examples?.join(" · ") ?? concept.description,
  };
}

export function resolveCurriculumUnit(
  curriculumUnitId: string,
  profile: UserSkillProfile,
): CurriculumUnit | undefined {
  if (isConceptUnitId(curriculumUnitId)) {
    const conceptId = curriculumUnitId.slice(CONCEPT_UNIT_PREFIX.length);
    return buildConceptUnit(conceptId, profile);
  }
  return undefined;
}
