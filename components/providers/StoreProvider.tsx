"use client";

import { useEffect } from "react";
import { useStudyStore } from "@/hooks/useStudyStore";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useStudyStore((s) => s.hydrate);
  const hydrated = useStudyStore((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
