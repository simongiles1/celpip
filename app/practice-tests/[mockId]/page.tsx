"use client";

import Link from "next/link";
import { use } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MockTestRunner } from "@/components/practice-tests/MockTestRunner";
import { getMockSpec } from "@/lib/celpip-mocks";

export default function MockRunnerPage({
  params,
}: {
  params: Promise<{ mockId: string }>;
}) {
  const { mockId } = use(params);
  const spec = getMockSpec(mockId);

  if (!spec) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Mock not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              The mock spec &ldquo;{mockId}&rdquo; does not exist.
            </p>
            <Link href="/practice-tests" className="mt-3 inline-block">
              <Button variant="outline" size="sm">
                Back to Practice Tests
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <MockTestRunner spec={spec} />;
}
