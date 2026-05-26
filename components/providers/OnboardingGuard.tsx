"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStudyStore } from "@/hooks/useStudyStore";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useStudyStore((s) => s.hydrated);
  const settings = useStudyStore((s) => s.settings);

  useEffect(() => {
    if (!hydrated) return;
    const isOnboarding = pathname === "/onboarding";
    if (!settings && !isOnboarding) {
      router.replace("/onboarding");
    } else if (settings && isOnboarding) {
      router.replace("/");
    }
  }, [hydrated, settings, pathname, router]);

  return <>{children}</>;
}
