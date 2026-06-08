import { insertFeedbackTicketMessage } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const createMessageSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = createMessageSchema.parse(await request.json());
    const message = insertFeedbackTicketMessage(id, body.body);

    if (!message) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    const errorMessage =
      error instanceof Error ? error.message : "Failed to add message";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
