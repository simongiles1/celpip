# CELPIP Pilot

Personalized CELPIP Reading & Writing study accelerator. Backfills a 7-day/week schedule from today to your exam date with 45-minute practice sessions powered by Gemini AI.

## Features

- **Interactive calendar** — Month/week views with drag-and-drop rescheduling
- **AI-generated practice** — Writing and Reading modules tailored to each curriculum unit
- **Instant CLB grading** — Gemini evaluates submissions on official CELPIP criteria (bands 1–12)
- **Analytics dashboard** — Score timeline and aggregated mistake log
- **Local persistence** — All progress saved to a SQLite database (`data/celpip.db`; export/import backup supported). Two sessions per day: writing at 9:00, reading at 10:00.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from the example:

```bash
cp .env.example .env.local
```

3. Add your [Google AI Studio](https://aistudio.google.com/apikey) API key:

```
GEMINI_API_KEY=your_key_here
```

4. Start the dev server:

```bash
npm run dev
```

Study data is stored in `data/celpip.db` (SQLite). Override the path with `DATABASE_PATH` in `.env.local` if needed. On first load, any existing browser `localStorage` data is migrated automatically into the database.

5. Open [http://localhost:3000](http://localhost:3000), set your exam date on onboarding, and start studying.

## Tech Stack

- Next.js 16 (App Router) + React + TypeScript
- Tailwind CSS
- FullCalendar (drag-and-drop scheduling)
- Zustand + SQLite (better-sqlite3)
- Google Gemini 1.5 Flash (generation & grading)
- Recharts (analytics)

## Project Structure

```
app/              # Pages and API routes
components/       # UI, calendar, session, analytics
data/             # Immutable 4-week curriculum
hooks/            # Zustand store
lib/              # Types, storage, schedule, prompts
```

## API Routes

- `POST /api/generate` — Generate practice content for a curriculum unit
- `POST /api/grade` — Grade a writing or reading submission

Both routes require `GEMINI_API_KEY` on the server.
