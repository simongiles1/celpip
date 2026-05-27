"use client";

import { Badge } from "@/components/ui/badge";
import {
  EXERCISE_KIND_META,
  type ExerciseKind,
} from "@/lib/exercise-types";

export function ExerciseKindBadge({ kind }: { kind: ExerciseKind }) {
  const meta = EXERCISE_KIND_META[kind];
  const variant =
    kind === "themed"
      ? "secondary"
      : kind === "celpip_mock"
        ? "outline"
        : "outline";

  return (
    <Badge variant={variant} title={meta.shortDescription}>
      {meta.label}
    </Badge>
  );
}
