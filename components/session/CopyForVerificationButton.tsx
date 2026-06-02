"use client";

import { useCallback, useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyForVerificationButtonProps {
  getText: () => string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  label?: string;
  copiedLabel?: string;
  ariaLabel?: string;
  iconOnly?: boolean;
}

export function CopyForVerificationButton({
  getText,
  size = "sm",
  variant = "outline",
  className,
  label = "Copy for AI verification",
  copiedLabel = "Copied!",
  ariaLabel,
  iconOnly = false,
}: CopyForVerificationButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = getText();

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [getText]);

  return (
    <Button
      type="button"
      size={iconOnly ? "icon" : size}
      variant={iconOnly ? "ghost" : variant}
      className={cn(
        "cursor-pointer",
        iconOnly ? "h-8 w-8 shrink-0" : "gap-1.5",
        className,
      )}
      onClick={() => void handleCopy()}
      aria-label={ariaLabel ?? (iconOnly ? "Copy as Markdown" : label)}
      title={iconOnly ? (ariaLabel ?? "Copy as Markdown") : undefined}
    >
      {copied ? (
        <Check className="h-4 w-4" />
      ) : (
        <ClipboardCopy className="h-4 w-4" />
      )}
      {!iconOnly && (copied ? copiedLabel : label)}
    </Button>
  );
}
