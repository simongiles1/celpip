"use client";

import { addDays, format } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useStudyStore } from "@/hooks/useStudyStore";
import { formatDateISO } from "@/lib/utils";

export default function OnboardingPage() {
  const router = useRouter();
  const initializeProgram = useStudyStore((s) => s.initializeProgram);
  const [examDate, setExamDate] = useState(
    formatDateISO(addDays(new Date(), 28)),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const minDate = formatDateISO(addDays(new Date(), 1));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await initializeProgram(examDate);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create schedule");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Welcome to CELPIP Pilot</CardTitle>
          <CardDescription>
            Set your official CELPIP exam date. We&apos;ll backfill a daily
            study plan from today with two 45-minute{" "}
            <span className="font-medium">themed practice</span> sessions per
            day — writing at 9:00 and reading at 10:00. These follow your
            skill schedule, not full official test replicas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="examDate">Official Exam Date</Label>
              <Input
                id="examDate"
                type="date"
                value={examDate}
                min={minDate}
                onChange={(e) => setExamDate(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500">
                Program starts today ({format(new Date(), "MMMM d, yyyy")}).
                Study sessions run daily until your exam.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Building schedule..." : "Start My Study Plan"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
