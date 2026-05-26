import { insertFeedbackTicket, loadFeedbackTickets } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const MAX_SCREENSHOT_LENGTH = 6_000_000;
const MAX_SCREENSHOTS = 10;

const screenshotSchema = z
  .string()
  .max(MAX_SCREENSHOT_LENGTH)
  .regex(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/);

const createTicketSchema = z.object({
  type: z.enum(["bug", "feature"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10_000),
  screenshotDataUrls: z.array(screenshotSchema).max(MAX_SCREENSHOTS).default([]),
});

export async function GET() {
  return NextResponse.json({ tickets: loadFeedbackTickets() });
}

export async function POST(request: Request) {
  try {
    const body = createTicketSchema.parse(await request.json());
    const ticket = insertFeedbackTicket({
      type: body.type,
      title: body.title,
      description: body.description,
      screenshotDataUrls: body.screenshotDataUrls,
    });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to create ticket";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
