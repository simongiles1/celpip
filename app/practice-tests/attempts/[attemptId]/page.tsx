"use client";

import { use } from "react";
import { MockAttemptReview } from "@/components/practice-tests/MockAttemptReview";

export default function MockAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = use(params);
  return <MockAttemptReview attemptId={attemptId} />;
}
