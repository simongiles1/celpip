import {
  buildFocusCandidates,
  rankAllFocusCandidates,
  selectFocusSet,
} from "@/lib/focus-selection";
import { weaknessTagsFromGrade } from "@/lib/focus-model";
import type {
  FocusSelectionRationale,
  GradeResponse,
  GradedSession,
  UserSkillProfile,
} from "@/lib/types";

export interface FocusWeaknessSummary {
  conceptId: string;
  label: string;
  evidence: string;
}

export interface FocusGradeAnalysis {
  weaknesses: FocusWeaknessSummary[];
  rankedCandidates: FocusSelectionRationale[];
  selectedFocusIds: string[];
  selectedRationale: FocusSelectionRationale[];
}

export function buildFocusGradeAnalysis(
  profile: UserSkillProfile,
  gradeResult: Pick<GradeResponse, "skillTags" | "focusRankings">,
  graded: GradedSession[] = [],
): FocusGradeAnalysis {
  const weaknesses = weaknessTagsFromGrade(profile, gradeResult.skillTags);
  const candidates = buildFocusCandidates(
    (gradeResult.skillTags ?? []).filter((tag) => tag.polarity === "weakness"),
    profile,
    gradeResult.focusRankings ?? [],
    graded,
  );
  const rankedCandidates = rankAllFocusCandidates(candidates, profile);
  const { selected, rationale } = selectFocusSet(candidates, profile);

  return {
    weaknesses,
    rankedCandidates,
    selectedFocusIds: selected,
    selectedRationale: rationale,
  };
}
