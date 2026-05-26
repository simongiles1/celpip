import {
  clearAllData,
  exportAllData,
  importAllData,
  loadAllData,
  savePartialData,
  type PartialAppData,
} from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("export") === "1") {
    return new NextResponse(exportAllData(), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return NextResponse.json(loadAllData());
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as PartialAppData;
    savePartialData(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PartialAppData & {
      action?: "import" | "migrate";
    };

    if (body.action === "import" || body.action === "migrate") {
      const payload = JSON.stringify({
        settings: body.settings,
        preferences: body.preferences,
        events: body.events,
        generated: body.generated,
        graded: body.graded,
        skillProfile: body.skillProfile,
        conceptCustomizations: body.conceptCustomizations,
      });
      const ok = importAllData(payload);
      if (!ok) {
        return NextResponse.json({ error: "Invalid import data" }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    savePartialData(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    clearAllData();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to clear data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
