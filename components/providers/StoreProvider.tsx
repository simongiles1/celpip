"use client";

import { useEffect } from "react";
import { useStudyStore } from "@/hooks/useStudyStore";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useStudyStore((s) => s.hydrate);
  const refreshFromServer = useStudyStore((s) => s.refreshFromServer);
  const hydrated = useStudyStore((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshFromServer();
      }
    };

    document.addEventListener("visibilitychange", syncWhenVisible);
    return () =>
      document.removeEventListener("visibilitychange", syncWhenVisible);
  }, [refreshFromServer]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
