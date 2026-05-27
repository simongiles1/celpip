"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Calendar" },
  { href: "/concepts", label: "Concept Lab" },
  { href: "/practice-tests", label: "Practice Tests" },
  { href: "/analytics", label: "Analytics" },
  { href: "/feedback", label: "Feedback" },
];

export function NavBar() {
  const pathname = usePathname();

  if (pathname === "/onboarding") return null;

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div>
          <Link href="/" className="text-lg font-bold text-gray-900">
            CELPIP Pilot
          </Link>
          <p className="text-xs text-gray-500">Personalized Study Accelerator</p>
        </div>
        <div className="flex items-center gap-1">
          <nav className="flex gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <SettingsDialog />
        </div>
      </div>
    </header>
  );
}
