# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Focused Mastery page (`/focus`)** — A separate, opt-in learning loop that picks 2–3 lowest-hanging-fruit writing concepts after each assessment, gates progression on concept drill quotas, and uses CELPIP-style focused assessments with dual-color inline review (focus-correct, focus-mistake, other-mistake).
- **Hybrid focus selection engine** — AI `focusRankings` shortlist combined with deterministic scoring using hand-authored concept priors (`data/concept-priors.ts`), current mastery, and per-exercise weakness frequency.
- **Focus model state** — Stored in `skill_profile.focusModel` with active focus set, drill progress, baselines, graduation history, and selection rationale; focused observations use `track: "focus"` for A/B separation from calendar analytics.
- **Focused generate/grade API modes** — `/api/generate` (`mode: "focused"`) and `/api/grade` (`gradingMode: "focused"`) with `focusHighlights` and `focusRankings` in the grade response.
- **Unit tests** — Coverage for `lib/focus-selection.ts` and `lib/focus-annotations.ts`.
- **Focus test response generator** — "Fill test response (AI)" button on focused assessments generates a 150–200 word learner draft with intentional mistakes (aligned to active focus concepts when set).

### Fixed

- **Focus assessment modal reset after grading** — Session config is snapshotted when the modal opens; grading no longer re-triggers prompt generation or clears results when the focus set updates.
- **Focus assessment modal layout** — Dialog panel width now matches content (`max-w-4xl` full width) so the right-side empty margin is removed.
- **Focus inline review popovers** — Focused assessment highlights now use the same rich hover popover as calendar writing (fix, concept, practice link).
- **Focus analysis panel** — Post-grade section lists all weakness concepts, ranks them, and explains the recommended 2–3 low-hanging-fruit focus set with justification.
- **Focus test fill always available** — “Fill test response (AI)” is shown in all environments (not limited to localhost).
