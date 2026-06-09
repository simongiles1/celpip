# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Per-question concept drill checks** — Each exercise now has a Check answer button: correct responses show a simple confirmation; incorrect ones receive an AI hint first, then Show answer reveals the full explanation (same style as set grading). Bulk Submit for Grading is unchanged.
- **Concept drill hint and acceptability guidance** — Hints now anchor to the sentence, teach a reusable pattern, and include a "You wouldn't say…" negative example. Multiple-choice checks and grading accept alternate options that are natural in context (not only the keyed correctAnswerIndex). Generation rules require only one clearly best option per item.
- **Concept drill multi-select** — When two or more MC options genuinely work, exercises switch to checkboxes with "select all that fit" copy. `acceptableAnswerIndexes` can be set at generation or discovered on check; single-answer items stay radio buttons.
- **Concept drill acceptability on load** — Question sets annotate acceptable answers when the set opens (one batch call), so multi-select vs radio is correct before the first check. MC checks always use the API (no client-side correct shortcut) so acceptability stays in sync.
- **Concept drill acceptability loading state** — While acceptability is being resolved, answer options stay hidden with a short "Preparing answer options…" message so the UI does not flip from radio to checkbox after the annotate call returns.
- **Persisted concept drill acceptability** — `acceptableAnswerIndexes` is required when MC question sets are generated and stored in `concept_drill_items`. Legacy sets without that field are annotated once, saved via `updateConceptDrillItems`, and skip re-annotation on later loads.
- **`npm run dev:restart`** — Windows script kills anything on port 3004 and starts the dev server again.
- **Feedback ticket replies** — Each feedback ticket now has a thread where either party can post anonymous replies; messages sync on send, window focus, and every 15 seconds while the page is open.
- **Focus Lab tab strip** — `/focus` now has four tabs: Focus Set (active concepts + drills), Focus History (completed cycles archive), Assessment Bands (calendar + focus CLB timeline), and Practice Priority (full concept ranking with rolling window).
- **Practice priority engine (`lib/focus-priority.ts`)** — Ranks all writing concepts by three metrics: CELPIP exam frequency (AI priors), user mistake rate (calendar subtest + focus + concept drills), and ease of correction (AI priors adjusted as mastery changes). Includes a Gaussian rolling window that starts at 2 concepts and expands to 3 as the lead concept improves.
- **Calendar data in focus selection** — `buildFocusCandidates` now merges historical weakness counts from calendar writing alongside current assessment tags when picking the focus set.
- **Combined assessment bands chart** — Assessment Bands tab plots CLB scores from both calendar writing exercises and focused assessments on one timeline.

### Changed

- **Dev server port** — Local dev and production start scripts now bind to port 3004 instead of the Next.js default (3000).
- **Focus Set vs Focus History** — Each tab now explains the distinction: focus set = what you are working on now; focus history = archive of past cycles with start/graduation dates.
- **Hybrid focus selection engine** — AI `focusRankings` shortlist combined with deterministic scoring using hand-authored concept priors (`data/concept-priors.ts`), current mastery, and per-exercise weakness frequency.
- **Focus model state** — Stored in `skill_profile.focusModel` with active focus set, drill progress, baselines, graduation history, and selection rationale; focused observations use `track: "focus"` for A/B separation from calendar analytics.
- **Focused generate/grade API modes** — `/api/generate` (`mode: "focused"`) and `/api/grade` (`gradingMode: "focused"`) with `focusHighlights` and `focusRankings` in the grade response.
- **Unit tests** — Coverage for `lib/focus-selection.ts` and `lib/focus-annotations.ts`.
- **Focus test response generator** — "Fill test response (AI)" button on focused assessments generates a 150–200 word learner draft with intentional mistakes (aligned to active focus concepts when set).

### Fixed

- **Vocabulary session repeats** — Daily vocabulary generation now excludes words from all prior calendar sessions (validated server-side with retry), so each new session receives unique words instead of repeating the same list several times per week.
- **Sticky site header** — The main navigation bar now stays fixed at the top of the viewport while page content scrolls underneath.
- **Focus data lost after refresh** — Focused assessments now persist graded results and focus model updates in a single server save instead of three racing writes; switching back to a tab reloads the latest data from the server without a full page refresh.
- **Focus assessment modal reset after grading** — Session config is snapshotted when the modal opens; grading no longer re-triggers prompt generation or clears results when the focus set updates.
- **Focus assessment modal layout** — Dialog panel width now matches content (`max-w-4xl` full width) so the right-side empty margin is removed.
- **Focus inline review popovers** — Focused assessment highlights now use the same rich hover popover as calendar writing (fix, concept, practice link).
- **Focus analysis panel** — Post-grade section lists all weakness concepts, ranks them, and explains the recommended 2–3 low-hanging-fruit focus set with justification.
- **Focus test fill always available** — “Fill test response (AI)” is shown in all environments (not limited to localhost).
