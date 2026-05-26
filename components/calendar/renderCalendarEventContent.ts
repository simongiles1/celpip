import type { EventContentArg } from "@fullcalendar/core";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ICON_SIZE = 14;

const CONTENT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`;

const COMPLETED_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`;

export function renderCalendarEventContent(arg: EventContentArg) {
  const { hasGenerated, isCompleted } = arg.event.extendedProps as {
    hasGenerated?: boolean;
    isCompleted?: boolean;
  };

  const icons: string[] = [];
  if (hasGenerated) {
    icons.push(
      `<span class="study-cal-event-icon" title="Practice content ready">${CONTENT_ICON}</span>`,
    );
  }
  if (isCompleted) {
    icons.push(
      `<span class="study-cal-event-icon study-cal-event-icon--completed" title="Session completed">${COMPLETED_ICON}</span>`,
    );
  }

  const timeHtml = arg.timeText
    ? `<div class="study-cal-event-time">${escapeHtml(arg.timeText)}</div>`
    : "";

  const iconsHtml = icons.length
    ? `<span class="study-cal-event-icons">${icons.join("")}</span>`
    : "";

  return {
    html: `<div class="study-cal-event-body${icons.length ? " study-cal-event-body--has-icons" : ""}">
      <div class="study-cal-event-text">
        ${timeHtml}
        <div class="study-cal-event-title">${escapeHtml(arg.event.title)}</div>
      </div>
      ${iconsHtml}
    </div>`,
  };
}
