"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Bug,
  CheckCircle2,
  ClipboardPaste,
  ImageIcon,
  Lightbulb,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FeedbackTicket, FeedbackTicketType } from "@/lib/types";
import { cn } from "@/lib/utils";

type FilterView = "all" | FeedbackTicketType;

const MAX_SCREENSHOTS = 10;

const filterOptions: { id: FilterView; label: string }[] = [
  { id: "all", label: "All" },
  { id: "feature", label: "Features" },
  { id: "bug", label: "Bugs" },
];

export default function FeedbackPage() {
  const [filter, setFilter] = useState<FilterView>("all");
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<FeedbackTicket | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  const [type, setType] = useState<FeedbackTicketType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshotDataUrls, setScreenshotDataUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLTextAreaElement>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/feedback");
      if (!response.ok) {
        throw new Error("Failed to load tickets");
      }
      const data = (await response.json()) as { tickets: FeedbackTicket[] };
      setTickets(data.tickets);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const filteredTickets = useMemo(() => {
    if (filter === "all") return tickets;
    return tickets.filter((ticket) => ticket.type === filter);
  }, [filter, tickets]);

  const addScreenshotFromFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setScreenshotDataUrls((current) =>
        current.length >= MAX_SCREENSHOTS
          ? current
          : [...current, reader.result as string],
      );
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePasteScreenshot = (event: React.ClipboardEvent) => {
    if (screenshotDataUrls.length >= MAX_SCREENSHOTS) return;

    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;

      event.preventDefault();
      addScreenshotFromFile(file);
      pasteAreaRef.current?.blur();
      return;
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    let remaining = MAX_SCREENSHOTS - screenshotDataUrls.length;
    for (const file of files) {
      if (remaining <= 0) break;
      addScreenshotFromFile(file);
      remaining -= 1;
    }

    event.target.value = "";
  };

  const focusPasteArea = () => {
    if (screenshotDataUrls.length >= MAX_SCREENSHOTS) return;
    const pasteArea = pasteAreaRef.current;
    if (!pasteArea) return;
    pasteArea.focus({ preventScroll: true });
    pasteArea.setSelectionRange(0, 0);
  };

  const removeScreenshot = (index: number) => {
    setScreenshotDataUrls((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const resetForm = () => {
    setType("bug");
    setTitle("");
    setDescription("");
    setScreenshotDataUrls([]);
    setSubmitError(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          screenshotDataUrls,
        }),
      });

      const data = (await response.json()) as {
        ticket?: FeedbackTicket;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to submit ticket");
      }

      if (data.ticket) {
        setTickets((current) => [data.ticket!, ...current]);
      }
      handleDialogOpenChange(false);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit ticket",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    setClosingId(ticketId);
    try {
      const response = await fetch(`/api/feedback/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });

      const data = (await response.json()) as {
        ticket?: FeedbackTicket;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to close ticket");
      }

      if (data.ticket) {
        setTickets((current) =>
          current.map((ticket) =>
            ticket.id === ticketId ? data.ticket! : ticket,
          ),
        );
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to close ticket",
      );
    } finally {
      setClosingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/feedback/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete ticket");
      }

      setTickets((current) =>
        current.filter((ticket) => ticket.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete ticket",
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open && !deleting) {
      setDeleteTarget(null);
      setDeleteError(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feedback & Issues</h1>
          <p className="text-sm text-gray-600">
            Report bugs or request features. Attach screenshots from your device or
            clipboard when reporting UI issues.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New ticket
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterView)}>
        <TabsList>
          {filterOptions.map((option) => (
            <TabsTrigger key={option.id} value={option.id}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {filter === "all"
              ? "All tickets"
              : filter === "feature"
                ? "Feature requests"
                : "Bug reports"}
          </h2>
          <span className="text-sm text-gray-500">
            {filteredTickets.length} item{filteredTickets.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-gray-500">
              Loading tickets...
            </CardContent>
          </Card>
        ) : filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-gray-500">
              No {filter === "all" ? "" : filter === "feature" ? "feature " : "bug "}
              tickets yet.
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => (
            <Card
              key={ticket.id}
              className={cn(ticket.status === "closed" && "opacity-75")}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={ticket.type === "bug" ? "warning" : "default"}
                        className={cn(
                          ticket.type === "bug" && "bg-red-100 text-red-800",
                        )}
                      >
                        {ticket.type === "bug" ? (
                          <>
                            <Bug className="mr-1 h-3 w-3" />
                            Bug
                          </>
                        ) : (
                          <>
                            <Lightbulb className="mr-1 h-3 w-3" />
                            Feature
                          </>
                        )}
                      </Badge>
                      {ticket.status === "closed" && (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Closed
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">
                        {format(new Date(ticket.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                    <CardTitle
                      className={cn(
                        "text-base",
                        ticket.status === "closed" && "text-gray-500 line-through",
                      )}
                    >
                      {ticket.title}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    {ticket.status === "open" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleCloseTicket(ticket.id)}
                        disabled={closingId === ticket.id}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {closingId === ticket.id ? "Closing..." : "Mark closed"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-500 hover:text-red-600"
                      onClick={() => setDeleteTarget(ticket)}
                      aria-label={`Delete ticket: ${ticket.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap text-sm text-gray-700">
                  {ticket.description}
                </p>
                {ticket.screenshotDataUrls.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Screenshots ({ticket.screenshotDataUrls.length})
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ticket.screenshotDataUrls.map((screenshot, index) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          key={`${ticket.id}-screenshot-${index}`}
                          src={screenshot}
                          alt={`Screenshot ${index + 1} for ${ticket.title}`}
                          className="max-h-80 w-full rounded-md border border-gray-200 object-contain"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange} panelClassName="max-w-lg">
        <DialogHeader onClose={() => handleDialogOpenChange(false)}>
          <DialogTitle>New ticket</DialogTitle>
        </DialogHeader>
        <DialogContent className="overflow-y-auto">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {submitError}
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none text-gray-700">
                Type
              </legend>
              <div className="flex gap-2">
                {(
                  [
                    {
                      id: "bug" as const,
                      label: "Bug",
                      icon: Bug,
                    },
                    {
                      id: "feature" as const,
                      label: "Feature",
                      icon: Lightbulb,
                    },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      if (type !== option.id) setType(option.id);
                    }}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      type === option.id
                        ? cn(
                            "cursor-default",
                            option.id === "bug"
                              ? "border-red-300 bg-red-50 text-red-800"
                              : "border-amber-300 bg-amber-50 text-amber-900",
                          )
                        : "cursor-pointer border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                    )}
                  >
                    <option.icon className="h-4 w-4" />
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="ticket-title">Title</Label>
              <Input
                id="ticket-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Short summary"
                required
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket-description">Description</Label>
              <Textarea
                id="ticket-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Steps to reproduce, expected behavior, or feature details"
                required
                maxLength={10000}
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Screenshots</Label>
                <span className="text-xs text-gray-500">
                  {screenshotDataUrls.length}/{MAX_SCREENSHOTS}
                </span>
              </div>

              {screenshotDataUrls.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {screenshotDataUrls.map((screenshot, index) => (
                    <div
                      key={`draft-screenshot-${index}`}
                      className="relative rounded-md border border-gray-200 bg-gray-50 p-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={screenshot}
                        alt={`Pasted screenshot ${index + 1}`}
                        className="max-h-28 w-full rounded object-contain"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-7 w-7 bg-white/90 hover:bg-white"
                        onClick={() => removeScreenshot(index)}
                        aria-label={`Remove screenshot ${index + 1}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                onChange={handleFileSelect}
                disabled={screenshotDataUrls.length >= MAX_SCREENSHOTS}
              />

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={screenshotDataUrls.length >= MAX_SCREENSHOTS}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Choose photo or file
              </Button>

              <div className="relative hidden sm:block">
                <textarea
                  ref={pasteAreaRef}
                  readOnly
                  aria-label="Paste screenshot from clipboard"
                  onPaste={handlePasteScreenshot}
                  onClick={focusPasteArea}
                  onFocus={(event) => event.target.setSelectionRange(0, 0)}
                  disabled={screenshotDataUrls.length >= MAX_SCREENSHOTS}
                  className={cn(
                    "relative min-h-[132px] w-full resize-none rounded-lg border-2 border-dashed bg-transparent p-4 text-transparent caret-transparent outline-none transition-colors",
                    "focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20",
                    screenshotDataUrls.length >= MAX_SCREENSHOTS
                      ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
                      : "cursor-text border-gray-300 hover:border-gray-400",
                  )}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-gray-500"
                >
                  <ClipboardPaste className="h-7 w-7 text-gray-400" />
                  <p className="font-medium text-gray-700">Click here, then paste</p>
                  <p>
                    {screenshotDataUrls.length >= MAX_SCREENSHOTS
                      ? "Maximum screenshots reached"
                      : "Use Ctrl+V or Cmd+V after clicking here"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleDialogOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={submitting || !title.trim() || !description.trim()}
              >
                {submitting ? "Submitting..." : "Submit ticket"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={handleDeleteDialogOpenChange}
        size="auto"
        panelClassName="max-w-md"
      >
        <DialogHeader onClose={() => handleDeleteDialogOpenChange(false)}>
          <DialogTitle>Delete ticket?</DialogTitle>
        </DialogHeader>
        <DialogContent compact>
          <div className="space-y-4">
            {deleteError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {deleteError}
              </div>
            )}
            <p className="text-sm text-gray-600">
              This will permanently delete{" "}
              <span className="font-medium text-gray-900">
                {deleteTarget?.title}
              </span>
              . This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleDeleteDialogOpenChange(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                onClick={() => void handleDeleteConfirm()}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete ticket"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
