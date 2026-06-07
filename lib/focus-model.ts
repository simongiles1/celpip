import {
  buildFocusCandidates,
  emptyFocusModel,
  ensureFocusModel,
  evaluateGraduations,
  selectFocusSet,
} from "@/lib/focus-selection";
import { getConceptById, normalizeConceptId } from "@/lib/skill-profile";
import type {
  FocusModelState,
  FocusSelectionRationale,
  GradeResponse,
  SkillTag,
  UserSkillProfile,
} from "@/lib/types";

export function withFocusModel(profile: UserSkillProfile): UserSkillProfile {
  if (profile.focusModel) return profile;
  return { ...profile, focusModel: emptyFocusModel() };
}

export function setActiveFocusSet(
  profile: UserSkillProfile,
  conceptIds: string[],
  rationale?: FocusSelectionRationale[],
): UserSkillProfile {
  const focusModel = ensureFocusModel(profile);
  const now = new Date().toISOString();
  const baselineByConcept = { ...focusModel.baselineByConcept };

  for (const conceptId of conceptIds) {
    if (baselineByConcept[conceptId]) continue;
    const score = profile.conceptScores.find((s) => s.conceptId === conceptId);
    const instanceCount =
      profile.writingConceptStats?.[conceptId]?.instanceCount ?? 0;
    baselineByConcept[conceptId] = {
      mastery: score?.mastery ?? 50,
      instanceCount,
    };
  }

  const history = [...focusModel.focusHistory];
  if (conceptIds.length > 0) {
    history.push({
      conceptIds,
      startedAt: now,
      rationale: rationale
        ?.map((r) => `${r.conceptId}: ${r.rationale}`)
        .join(" · "),
    });
  }

  return {
    ...profile,
    focusModel: {
      ...focusModel,
      activeFocus: conceptIds,
      focusHistory: history,
      baselineByConcept,
      lastSelectionRationale: rationale,
      practiceCompleted: conceptIds.reduce<Record<string, number>>(
        (acc, id) => {
          acc[id] = focusModel.practiceCompleted[id] ?? 0;
          return acc;
        },
        {},
      ),
    },
  };
}

export function recordFocusPractice(
  profile: UserSkillProfile,
  conceptId: string,
): UserSkillProfile {
  const focusModel = ensureFocusModel(profile);
  return {
    ...profile,
    focusModel: {
      ...focusModel,
      practiceCompleted: {
        ...focusModel.practiceCompleted,
        [conceptId]: (focusModel.practiceCompleted[conceptId] ?? 0) + 1,
      },
    },
  };
}

export function graduateFocusConcepts(
  profile: UserSkillProfile,
  graduatedIds: string[],
): UserSkillProfile {
  if (graduatedIds.length === 0) return profile;

  const focusModel = ensureFocusModel(profile);
  const graduated = new Set(graduatedIds);
  const now = new Date().toISOString();

  const focusHistory = focusModel.focusHistory.map((entry) => {
    if (entry.graduatedAt) return entry;
    const allGraduated = entry.conceptIds.every((id) => graduated.has(id));
    if (!allGraduated) return entry;
    return { ...entry, graduatedAt: now };
  });

  const activeFocus = focusModel.activeFocus.filter((id) => !graduated.has(id));
  const practiceCompleted = { ...focusModel.practiceCompleted };
  for (const id of graduatedIds) {
    delete practiceCompleted[id];
  }

  return {
    ...profile,
    focusModel: {
      ...focusModel,
      activeFocus,
      focusHistory,
      practiceCompleted,
    },
  };
}

export function setLastFocusAssessment(
  profile: UserSkillProfile,
  eventId: string,
): UserSkillProfile {
  const focusModel = ensureFocusModel(profile);
  return {
    ...profile,
    focusModel: {
      ...focusModel,
      lastAssessmentEventId: eventId,
    },
  };
}

export function processFocusGradeResult(
  profile: UserSkillProfile,
  gradeResult: Pick<
    GradeResponse,
    "skillTags" | "focusRankings"
  >,
): {
  profile: UserSkillProfile;
  graduated: string[];
  nextFocus: string[];
  rationale: FocusSelectionRationale[];
} {
  const focusModel = ensureFocusModel(profile);
  const tags = gradeResult.skillTags ?? [];
  const weaknesses = tags.filter((tag) => tag.polarity === "weakness");

  const graduated = evaluateGraduations(
    focusModel.activeFocus,
    profile,
    focusModel,
    tags,
  );

  let nextProfile = graduateFocusConcepts(profile, graduated);
  const remainingFocus = ensureFocusModel(nextProfile).activeFocus;

  if (remainingFocus.length > 0) {
    return {
      profile: nextProfile,
      graduated,
      nextFocus: remainingFocus,
      rationale: focusModel.lastSelectionRationale ?? [],
    };
  }

  const candidates = buildFocusCandidates(
    weaknesses,
    nextProfile,
    gradeResult.focusRankings ?? [],
  );

  const { selected, rationale } = selectFocusSet(candidates, nextProfile);
  nextProfile = setActiveFocusSet(nextProfile, selected, rationale);

  return {
    profile: nextProfile,
    graduated,
    nextFocus: selected,
    rationale,
  };
}

export function weaknessTagsFromGrade(
  profile: UserSkillProfile,
  tags: SkillTag[] | undefined,
): Array<{ conceptId: string; label: string; evidence: string }> {
  const weaknesses = (tags ?? []).filter((tag) => tag.polarity === "weakness");
  const byConcept = new Map<string, { conceptId: string; label: string; evidence: string }>();

  for (const tag of weaknesses) {
    const { conceptId } = normalizeConceptId(tag, profile);
    const concept = getConceptById(profile, conceptId);
    const label = concept?.label ?? tag.label ?? conceptId.replace(/_/g, " ");
    const evidence = tag.evidence.trim();
    const existing = byConcept.get(conceptId);
    if (existing) {
      if (evidence && !existing.evidence.includes(evidence)) {
        existing.evidence = `${existing.evidence} · ${evidence}`;
      }
      continue;
    }
    byConcept.set(conceptId, { conceptId, label, evidence });
  }

  return Array.from(byConcept.values());
}
