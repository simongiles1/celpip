"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Calendar" },
  { href: "/focus", label: "Focus" },
  { href: "/concepts", label: "Concept Lab" },
  { href: "/practice-tests", label: "Practice Tests" },
  { href: "/analytics", label: "Analytics" },
  { href: "/feedback", label: "Feedback" },
];

function NavLink({
  href,
  label,
  active,
  onClick,
  className,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "rounded-md px-4 py-2 text-sm font-medium transition-colors",
        active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100",
        className,
      )}
    >
      {label}
    </Link>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  if (pathname === "/onboarding") return null;

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <Link href="/" className="text-lg font-bold text-gray-900">
            CELPIP Pilot
          </Link>
          <p className="hidden text-xs text-gray-500 sm:block">
            Personalized Study Accelerator
          </p>
        </div>

        <div className="hidden items-center gap-1 md:flex">
          <nav className="flex gap-1">
            {links.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={pathname === link.href}
              />
            ))}
          </nav>
          <SettingsDialog />
        </div>

        <div className="flex shrink-0 items-center gap-1 md:hidden">
          <SettingsDialog />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
            className="text-gray-600"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
            onClick={closeMobileMenu}
            aria-label="Close menu"
          />
          <nav
            id="mobile-nav"
            className="absolute inset-x-0 top-full z-50 flex flex-col gap-1 border-b border-gray-200 bg-white px-4 py-3 shadow-sm md:hidden"
          >
            {links.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={pathname === link.href}
                onClick={closeMobileMenu}
                className="w-full px-3 py-3"
              />
            ))}
          </nav>
        </>
      )}
    </header>
  );
}
