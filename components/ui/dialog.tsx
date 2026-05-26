"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  panelClassName?: string;
}

export function Dialog({ open, onOpenChange, children, panelClassName }: DialogProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "relative z-50 flex h-[95vh] max-h-[95vh] w-full flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:rounded-xl",
          panelClassName ?? "max-w-5xl",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  className,
  children,
  onClose,
  trailing,
}: {
  className?: string;
  children: React.ReactNode;
  onClose?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-start justify-between border-b border-gray-200 px-6 py-4",
        className,
      )}
    >
      <div className="flex-1 pr-4">{children}</div>
      {(trailing || onClose) && (
        <div className="flex shrink-0 items-center gap-1">
          {trailing}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-xl font-semibold text-gray-900", className)} {...props} />
  );
}

export function DialogContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4 pb-6", className)}>
      {children}
    </div>
  );
}
