# Product Requirements Document (PRD)
## Project Name: CELPIP Pilot (Personalized Study Accelerator)

### 1. Executive Summary & Strategy
**CELPIP Pilot** is a specialized, interactive study application designed to prepare the user for the CELPIP General Test within a **4-week window**. 
* **MVP Scope (Weeks 1-4):** Focus heavily on **Reading** and **Writing** sub-tests.
* **V1.5/V2 Scope:** Modular expansion architecture for **Listening** (audio engine) and **Speaking** (microphone input + speech-to-text metrics analysis).
* **Development Strategy:** Optimized for AI-assisted "vibe coding" using a robust React/Next.js stack with client-side state management and live AI-generation endpoints powered by **Gemini**.

---

### 2. Tech Stack Blueprint
To maximize code-generation efficiency and app performance, the following technical framework is selected:
* **Framework:** Next.js (App Router) + React
* **Styling:** Tailwind CSS (Shadcn/ui for fast component generation: Calendar, Dialog, Cards, Tables)
* **State Management:** Client-side state persisted to `localStorage` (No complex databases needed for this local MVP development sprint).
* **LLM Integration:** Next.js Route Handlers (API Routes) interacting with the **Google Gen AI SDK** (Gemini 1.5 Flash/Pro for speed and reasoning depth).

---

### 3. Core Feature Requirements

#### Feature 1: Dynamic Interactive Calendar View
* **Views:** Full Month View and Full Week View toggles.
* **Interactivity:** Full drag-and-drop support. The user must be able to change an event's date (Month/Week view) and adjust time blocks (Week view).
* **Curriculum Engine:** The application automatically populates a 4-week roadmap baseline on first mount using an immutable programmatic array of objects derived from the user's uploaded curriculum.

#### Feature 2: Contextual Study Session Popups (Modals)
When clicking an active calendar event, a detailed overlay window opens containing:
1. **Focus Header:** Clear displaying of Goals, Grammar Focus, and Strategy.
2. **AI Instruction Box:** Rendered markdown instructions and high-scoring examples fetched/generated for that exact focus area.
3. **Practice Module:** * **Writing:** A real-time text input region containing a live **Word Counter** (Target constraint: 150–200 words) and a mock **Spell Checker**.
   * **Reading:** A split-pane screen showing a simulated CELPIP Reading Passage (Left) and interactive Multiple-Choice Questions (Right).

#### Feature 3: Immediate AI Grading & Feedback Loop
* **The Action:** Clicking "Submit Exam Response" calls a Next.js API route targeting Gemini.
* **The Response:** The model evaluates the submission instantly using authentic CELPIP scoring metrics (CLB levels 1–12).
* **Persistence:** The graded payload saves to `localStorage` under historical session metrics.

#### Feature 4: Analytics Tracker Dashboard
* A tracking timeline showing scores categorized by test type (Reading/Writing) over the 4-week timeline.
* A "Mistake Log" component that pulls flagged problem fields from previous Gemini evaluations to enable smart targeted revision.

---

### 4. 4-Week Auto-Populating Schedule Baseline
The application will map out the complete 4-week program automatically. The following curriculum structures your data schema:

#### Weeks 1 & 2: Skill Acquisition Foundation
| Week | Day | Focus Sub-test | Focus Target | Practice Type | Session Goal |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **W1** | Mon | Writing | Complex Sentences / Task 1 Structure | Email Task 1 | Improve Organization |
| **W1** | Tue | Writing | Connectors & Transitions / Sentence Variety | Survey Task 2 | Improve Flow & Cohesion |
| **W1** | Wed | Writing | Vocabulary Precision / Strong Examples | Survey Task 2 | Better Word Choice |
| **W1** | Thu | Writing | Paragraph Cohesion / Task 1 Tone & Formality | Email Task 1 | Improve Readability |
| **W1** | Fri | Writing | Grammar Accuracy / PEER Method | Survey Task 2 | Better Idea Development |
| **W1** | Sat/Sun | Writing | Grammar Correction / Full Mock Strategy | Task 1 + Task 2 | Complete Mistake Log Review |
| **W1** | Mon | Reading | Skimming & Scanning / Find Keywords Quickly | Part 1: Correspondence | Improve Reading Speed |
| **W1** | Tue | Reading | Vocabulary in Context / Synonyms & Paraphrasing | Part 2: Diagram Application| Improve Comprehension |
| **W1** | Wed | Reading | Main Idea Identification | Part 3: Info Matching | Better Distractor Analysis |
| **W1** | Thu | Reading | Detail Extraction Questions | Part 4: Viewpoints | Improve Fact Extraction Precision |
| **W1** | Fri | Reading | Inference Questions / Tone & Implied Meaning | Part 4: Viewpoints | Improve Logic Deduction |
| **W1** | Sat/Sun | Reading | Full Reading Mock Test Simulation | All Reading Parts | Build Exam Endurance |
| **W2** | Mon | Writing | Formal Phrases / Email Tone Matrix | Email Task 1 | Strong Task Fulfillment |
| **W2** | Tue | Writing | Advanced Structural Grammar / Fast Outlining | Survey Task 2 | Faster Planning Workflows |
| **W2** | Wed | Writing | Articles & Prepositions | Email Task 1 | Eliminate Micro Grammar Errors |
| **W2** | Thu | Writing | Cohesion Devices / Topic Sentences | Survey Task 2 | Smoother Structural Readability |
| **W2** | Fri | Writing | Example Building / Supporting Arguments | Survey Task 2 | Better Coherence Metrics |
| **W2** | Sat/Sun | Writing | Advanced Error Verification Patterns | Full Essay Sets | Structural Speed Auditing |
| **W2** | Mon | Reading | Time Management Paradigms / Speed Reading | Part 1: Correspondence | Improve Pacing Protocols |
| **W2** | Tue | Reading | Paraphrasing / Matching Abstract Ideas | Part 2: Diagram Application| Stronger Option Recognition |
| **W2** | Wed | Reading | Complicated Logic Verification | Part 3: Info Matching | Reduce Common Traps |
| **W2** | Thu | Reading | Reading Flow Mastery | Part 4: Viewpoints | Better Retention Across Texts |
| **W2** | Fri | Reading | Accuracy Isolation Under Time Pressure | Mixed Mini-Test | Execute Consistency |
| **W2** | Sat/Sun | Reading | Full Mock Simulator Environment | 38 Questions Timed | Band 9 Readiness Evaluation |

#### Weeks 3 & 4: Advanced Timing & Weakness Attack (Extended Baseline)
| Week | Day | Focus Sub-test | Focus Target | Practice Type | Session Goal |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **W3** | Mon | Writing | High-Tier Idiomatic Phrasal Verbs (Formal) | Email Task 1 | Score Band 10-12 Vocabulary |
| **W3** | Tue | Writing | Advanced Concession Structures (Although/While) | Survey Task 2 | Advanced Argumentative Balance |
| **W3** | Wed | Reading | Part 3 Strategy: Eliminating Distracters | Part 3: Info Matching | Absolute Accuracy Under 10 Mins |
| **W3** | Thu | Reading | Part 4 Strategy: Author Intent & Nuance | Part 4: Viewpoints | Isolate Implicit Views Perfectly |
| **W3** | Fri | Mixed | Time Management Crunch (Writing + Reading Parts) | Task 1 + Reading Part 1 | Fluid Switching Agility |
| **W3** | Sat/Sun | Full Mock | Back-to-Back Reading + Writing Sim | Complete Half-Battery | Build Maximum Focus Under Stress |
| **W4** | Mon | Review | Targeted Error Log Clearance (From App Data) | Custom Generation | Eliminate Repeat Mistakes |
| **W4** | Tue | Writing | Ultimate Speed Outlining Drills (2 Mins Prep) | Task 1 & Task 2 | Instant Planning Under Pressure |
| **W4** | Wed | Reading | Ultra-Fast Scanning Verification Methods | Parts 1-4 Speedrun | Secure 15 Minutes Review Time |
| **W4** | Thu | Writing | Final Structural Polish & Self-Correction Drills| Task 1 & Task 2 | Zero Grammar Flaws Objective |
| **W4** | Fri | Relax/Rev | Light Review of Templates and Core Phrases | Dashboard Overview | Peak Cognitive Confidence |
| **W4** | Sat/Sun | **EXAM** | **Official CELPIP Test Date** | **Real Exam Battery** | **Achieve Target CLB 9+** |

---

### 5. Gemini Prompt & AI Integration Specifications

To ensure prompt stability while vibe coding, use this precise backend logic interface:

#### Dynamic Prompt Template (Instruction/Exam Generation)
```text
You are an expert CELPIP examiner. Generate a practice module for the following study unit:
Focus Sub-test: {focusSubTest}
Target Concept: {focusTarget}
Practice Assignment Type: {practiceType}

Provide a JSON response with these exact keys:
1. "instructions": Markdown string containing a detailed tutorial and high-scoring strategies.
2. "example": An authentic CLB level 11/12 sample response or walkthrough.
3. "examPrompt": The test prompt. (If Writing: provide an email scenario or survey question. If Reading: provide a multi-paragraph text passage).
4. "readingQuestions": An array of objects containing "question", "options" (array of 4 strings), and "correctAnswerIndex" (Only if focus is Reading).