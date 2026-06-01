import type { ConceptDefinition } from "@/lib/types";

const CONCEPT_DOCUMENTS: Record<string, string> = {
  preposition_in_at_on: `# In, at, and on (time & place)

## Place

| Use | Pattern | Examples |
|-----|---------|----------|
| **at** | Specific point or venue | at the office, at the door, at home |
| **on** | Surface, street, floor | on the table, on Main Street, on the second floor |
| **in** | Enclosed space, city, country | in the room, in Toronto, in Canada |

**Quick checks**
- **at** → a pin on a map (at the station)
- **on** → touching a surface or named street (on Bay Street)
- **in** → inside a boundary (in the building, in March)

## Time

| Use | Pattern | Examples |
|-----|---------|----------|
| **at** | Clock times, night, weekend (specific) | at 3 p.m., at night, at the weekend |
| **on** | Days and dates | on Monday, on June 5 |
| **in** | Longer periods | in March, in 2026, in the morning |

## Common mistakes

- ❌ *I am in the office* (when you mean your workplace as a point) → ✅ **at** the office
- ❌ *The meeting is in Monday* → ✅ **on** Monday
- ❌ *She lives at Toronto* → ✅ **in** Toronto

## Worked example

> **Prompt:** Complete: "The presentation starts ___ 9 a.m. ___ Friday ___ the conference room."

> **Answer:** The presentation starts **at** 9 a.m. **on** Friday **in** the conference room.
`,

  infinitive_to_usage: `# When to use 'to' (and when not to)

## Core rule

Use **to** after verbs of **movement toward** a place. Do **not** add **to** after **enter**, **arrive**, **reach**, or **visit** — these verbs already include the direction.

This concept is **not** about choosing *at / in / on*.

## Use **to** (movement toward)

| Verb | Pattern | Example |
|------|---------|---------|
| go, walk, drive, travel, head, fly, run | verb + **to** + place | I **go to** the store. |
| move, return (when meaning "go back") | verb + **to** + place | We **returned to** the office. |

## Do **not** use **to**

| Verb | Pattern | Example |
|------|---------|---------|
| enter | enter + place | ✅ enter **the** building · ❌ enter **to** the building |
| arrive | arrive **at/in** + place | ✅ arrive **at** the airport |
| reach | reach + place | ✅ reach **the** summit |
| visit | visit + place | ✅ visit **my** cousin |

## Common mistakes

- ❌ *I entered to the room* → ✅ **entered the room**
- ❌ *She arrived to Toronto* → ✅ **arrived in Toronto**
- ❌ *We go the store* (missing **to**) → ✅ **go to** the store

## Worked example

> **Which sentence is correct?**
>
> A) I walked to the reception desk and entered to the office.
>
> B) I walked to the reception desk and entered the office.
>
> **Answer:** B — **walked to** (movement) but **entered** takes a direct object with no **to**.
`,

  articles_a_an_the: `# Articles (a, an, the)

## Core rule

Articles signal whether a noun is **general/introduced** (*a/an*) or **specific/known** (*the*). Some nouns take **no article** (zero article).

## a vs an

| Use | Rule | Examples |
|-----|------|----------|
| **a** | Before consonant **sound** | a report, a university (sounds like "yoo-") |
| **an** | Before vowel **sound** | an email, an hour (silent h) |

## the (definite)

Use **the** when the reader can identify **which one**:

- Already mentioned: I received an email. **The** email asked for documents.
- Unique in context: **The** manager approved **the** request.
- Only one exists: **the** sun, **the** CELPIP test

## Zero article (no article)

Often with **uncountable** or **general plural** nouns in formal writing:

- ✅ *We need **feedback** by Friday.* (not *a feedback*)
- ✅ *Employees must submit **documentation**.* (general category)

## Common mistakes

- ❌ *I have an good idea* → ✅ **a** good idea
- ❌ *Manager approved request* → ✅ **The** manager approved **the** request
- ❌ *I need an information* → ✅ **information** (uncountable) or **a piece of information**

## Worked example

> **Complete:** "___ customer called about ___ issue we discussed last week."

> **Answer:** **A** customer called about **the** issue we discussed last week. (first mention → *a*; specific issue → *the*)
`,

  subject_verb_agreement: `# Subject-verb agreement

## Core rule

The verb must agree with the **grammatical subject** in number:

- **Singular subject** → singular verb (*is, has, writes*)
- **Plural subject** → plural verb (*are, have, write*)

Ignore words between subject and verb when choosing the verb form.

## Basic patterns

| Subject | Verb | Example |
|---------|------|---------|
| Singular noun | singular | The report **is** ready. |
| Plural noun | plural | The reports **are** ready. |
| he / she / it | singular | She **writes** clearly. |
| they / we | plural | They **write** clearly. |

## High-frequency traps

### There is / there are

Match the verb to the noun **after** *there*:

- There **is** a problem. · There **are** several problems.

### Prepositional phrases

The subject is **before** the preposition, not inside the phrase:

- The list **of options is** long. (subject = *list*, not *options*)
- One of the candidates **is** qualified. (subject = *one*)

### Indefinite pronouns

| Usually singular | Usually plural | Either |
|------------------|----------------|--------|
| everyone, someone, each, anybody | both, few, several | all, none, some (depends on meaning) |

- Everyone **is** responsible. · Both options **are** valid.

### Either … or / Neither … nor

Verb agrees with the **nearest** subject:

- Neither the manager nor the employees **are** available.
- Neither the employees nor the manager **is** available.

### Collective nouns (team, staff, government)

In formal CELPIP writing, treat as **singular** when the group acts as one unit:

- The team **is** meeting on Tuesday.

## Common mistakes

- ❌ *The data show* (informal plural) → ✅ **The data shows** / **show** (pick one register; formal writing often treats *data* as singular)
- ❌ *One of the students are late* → ✅ **is** late
- ❌ *Each of the reports have errors* → ✅ **has** errors

## Worked example

> **Correct the verb:** "The box of documents **are** on my desk."

> **Answer:** The box **of documents is** on my desk. (*box* = singular subject)
`,

  verb_tenses: `# Verb tenses and consistency

## Core rule

Choose tenses that match **when** the action happens and keep the **timeline consistent** within a paragraph. CELPIP writing often uses **past** for completed events and **present** for general facts or current situations.

## Common tenses in CELPIP writing

| Tense | Use | Example |
|-------|-----|---------|
| **Simple present** | Facts, habits, current state | The office **opens** at 9 a.m. |
| **Simple past** | Finished past actions | I **submitted** the form yesterday. |
| **Present perfect** | Past action linked to now | I **have attached** the file. |
| **Future (will / going to)** | Plans and predictions | We **will review** your application. |

## Consistency rules

- Do not shift randomly: ❌ *I **went** to the store and **buy** milk* → ✅ *I **went** … and **bought** …*
- Background vs main event: *While I **was waiting**, the clerk **helped** me.*
- Reported information: *The email **said** that the meeting **was** postponed.*

## Present perfect vs simple past

| Present perfect | Simple past |
|-----------------|-------------|
| Result matters now | Specific finished time |
| I **have received** your message. | I **received** your message **on Monday**. |

## Common mistakes

- ❌ *Yesterday I have finished the task* → ✅ **finished** (specific past time)
- ❌ *She is working here since 2020* → ✅ **has worked** here since 2020
- ❌ Mixing *will* and *would* without a reason in one email paragraph

## Worked example

> **Fix tense shift:** "Last week I **write** to HR and **am explaining** the issue."

> **Answer:** Last week I **wrote** to HR and **explained** the issue.
`,

  connectors_transitions: `# Connectors and transitions

## Core rule

Linking words show the **logical relationship** between ideas: contrast, cause, addition, or result. In CELPIP writing, prefer **formal** connectors over casual ones (*but*, *so*, *also* alone).

## By function

| Function | Formal connectors | Example |
|----------|-------------------|---------|
| **Contrast** | however, nevertheless, on the other hand | The cost is high; **however**, the quality is excellent. |
| **Cause** | because, since, due to | **Since** the deadline moved, we rescheduled. |
| **Result** | therefore, consequently, as a result | The files were incomplete; **therefore**, we delayed approval. |
| **Addition** | furthermore, moreover, in addition | The plan is feasible; **furthermore**, it is affordable. |

## Punctuation tips

- **However** / **Therefore** at start of sentence → often followed by comma: **However,** we disagree.
- **Moreover** between two independent clauses → semicolon or period before it.

## Common mistakes

- ❌ *I was tired, however I stayed.* (comma splice) → ✅ *I was tired**; however,** I stayed.* or two sentences
- ❌ *Furthermore* when ideas are unrelated (false cohesion)
- ❌ Overusing *and also* instead of one precise connector

## Worked example

> **Choose the best connector:** "The survey response rate was low; ___, we extended the deadline."

> **Answer:** **therefore** or **consequently** (result), not *however* (contrast).
`,

  formal_tone_register: `# Formal tone and register

## Core rule

CELPIP emails and survey responses expect **polite, professional** language: complete sentences, neutral or respectful tone, and no slang, texting abbreviations, or overly emotional wording.

## Formal vs informal

| Informal (avoid) | Formal (prefer) |
|------------------|-----------------|
| Hey / Hi guys | Dear Mr. Chen / Dear Hiring Manager |
| ASAP / gonna / wanna | as soon as possible / will |
| awesome / super mad | excellent / disappointed |
| Can you…? (blunt) | Could you please…? / I would appreciate it if… |
| Thanks!! | Thank you for your assistance. |

## Politeness patterns

- **Requests:** *I would appreciate it if you could…* · *Please let me know whether…*
- **Complaints:** State facts calmly; avoid blame (*Unfortunately, the delivery was delayed.*)
- **Closings:** *Sincerely,* · *Regards,* (match relationship to prompt)

## Common mistakes

- ❌ ALL CAPS for emphasis
- ❌ Emoji or exclamation piles (*Thanks!!!*)
- ❌ Sarcasm or jokes in workplace or official contexts

## Worked example

> **Which opening fits a formal email to a landlord?**
>
> A) Hey, my heat's busted again!!!
>
> B) Dear Ms. Patel, I am writing to report a problem with the heating system in my apartment.
>
> **Answer:** B
`,

  paragraph_structure: `# Paragraph structure (PEEL/PEER)

## Core rule

Each paragraph should have **one main idea**, introduced early, supported with details, and linked to your overall answer. PEEL/PEER is a checklist, not a rigid formula.

## PEEL / PEER

| Step | Meaning | What to write |
|------|---------|----------------|
| **P**oint | Topic sentence | State the paragraph's main claim |
| **E**vidence / **E**xample | Support | Fact, reason, or mini-example from the prompt |
| **E**xplanation | Link | Why this evidence supports your point |
| **L**ink (PEEL) / **R**esponse (PEER) | Tie-back | Connect to the task or next paragraph |

## CELPIP email / survey layout

1. **Opening** — purpose of writing (one short paragraph)
2. **Body** — one paragraph per bullet point or reason
3. **Closing** — polite next step or summary

## Common mistakes

- ❌ One long block with no topic sentences
- ❌ Repeating the prompt without adding support
- ❌ New unrelated idea in the last sentence with no link

## Worked example

> **Survey bullet:** "Explain why Option A is better."

> **Point:** Option A reduces commute time for most staff.
>
> **Evidence:** The new schedule starts at 10 a.m., avoiding peak traffic.
>
> **Link:** For these reasons, Option A better meets employees' needs.
`,

  task_fulfillment: `# Task fulfillment

## Core rule

A strong CELPIP response **answers every part of the prompt** with enough detail. Task fulfillment is scored separately from grammar — you can write correct English and still lose points for missing bullets or ignoring the scenario.

## Checklist before you submit

- [ ] Correct **recipient** and **purpose** (email) or **chosen option** (survey)
- [ ] All **bullet points** addressed with at least one clear sentence each
- [ ] **Word count** in range (typically 150–200 words)
- [ ] Tone matches the relationship (formal vs semi-formal)
- [ ] No off-topic story that ignores the scenario

## Email (Task 1)

- Read **who** you are writing to and **why**
- Use one paragraph (or clear section) per bullet
- Include greeting + closing appropriate to the relationship

## Survey (Task 2)

- State your **choice** in the first paragraph
- Give **two or more reasons** with examples
- Do not argue both sides equally — defend **one** option

## Common mistakes

- ❌ Answering only 2 of 3 bullets
- ❌ Describing the problem but never stating what you want the reader to do
- ❌ Writing a generic essay that could fit any prompt

## Worked example

> **Prompt bullets:** (1) explain the delay (2) apologize (3) propose a new meeting time

> **Weak:** Only apologizes, no new time.
>
> **Strong:** Covers all three with specific date/time for the meeting.
`,

  vocabulary_precision: `# Vocabulary precision

## Core rule

Choose words that are **specific** and appropriate for formal writing. Avoid vague words (*good, bad, thing, nice*) and repetition of the same basic verb (*get, do, say*).

## Upgrade vague language

| Vague | More precise |
|-------|----------------|
| good / bad | effective / inadequate, beneficial / harmful |
| big / small | substantial / minor, significant / limited |
| thing | issue, requirement, document, policy |
| get | obtain, receive, achieve, purchase |
| say | state, explain, confirm, argue |

## Register

- Prefer **neutral–formal** verbs in workplace writing: *assist* (not *help out*), *inform* (not *tell you real quick*)
- Use **concrete nouns**: *refund* instead of *money back*

## Common mistakes

- ❌ *The thing about the policy is good* → ✅ *The **advantage** of the policy is **clear**.*
- ❌ Repeating *important* five times → vary: *critical, essential, significant*

## Worked example

> **Improve:** "We got a bad result from the thing they did."

> **Answer:** "We **received an unsatisfactory outcome** from the **procedure they implemented**."
`,

  collocations: `# Collocations and phrasal verbs

## Core rule

A **collocation** is a natural word pairing native speakers expect (*make a decision*, not *do a decision*). **Phrasal verbs** (verb + particle) are common in English; in formal CELPIP writing, prefer **single-word Latin-based verbs** when the prompt is formal (*submit* vs *hand in*).

## Common formal collocations

| Pattern | Examples |
|---------|----------|
| verb + noun | **make** a decision, **take** responsibility, **meet** a deadline, **raise** a concern |
| adjective + noun | **strong** evidence, **key** factor, **brief** summary |
| verb + preposition | **apply for** a position, **comply with** regulations, **apologize for** the delay |

## Phrasal verbs in formal writing

| Casual phrasal | Formal alternative |
|----------------|-------------------|
| find out | determine, discover |
| put off | postpone, delay |
| look into | investigate, review |
| call off | cancel |

## Common mistakes

- ❌ *do a mistake* → ✅ **make** a mistake
- ❌ *discuss about* → ✅ **discuss** (no *about*) or **talk about**
- ❌ *inform to the client* → ✅ **inform the client**

## Worked example

> **Choose the natural phrase:** "We need to ___ a decision by Friday."

> **Answer:** **make** a decision (not *do* / *take* a decision in this frame)
`,

  skimming_scanning: `# Skimming and scanning

## Core rule

**Skimming** = read quickly for **gist** (main idea, structure). **Scanning** = hunt for **specific data** (dates, names, prices) without reading every word. CELPIP Reading is timed — strategy matters as much as vocabulary.

## When to use each

| Skill | Goal | How |
|-------|------|-----|
| **Skimming** | Main idea, tone, section purpose | Read title, first/last sentences of paragraphs |
| **Scanning** | One fact (date, %, name) | Let your eyes search for numbers, capitalized names, bold labels |

## By CELPIP Reading Part

| Part | Skim for… | Scan for… |
|------|-----------|-----------|
| **Part 1** (correspondence) | Who wrote to whom, purpose | Dates, requests, blank clues |
| **Part 2** (diagram) | What the visual shows overall | Labels, times, room numbers |
| **Part 3** (matching) | What each section A–D is about | Keywords matching statements |
| **Part 4** (viewpoints) | Author vs commenter stance | Opinion words, contrast signals |

## Common mistakes

- ❌ Reading the passage start-to-finish before looking at questions
- ❌ Re-reading the whole text for every question
- ❌ Missing synonyms — scanning only for identical words

## Worked example

> **Question:** "When does the workshop end?"

> **Strategy:** Scan the schedule/diagram for **times** and the word *workshop* — do not reread the entire email first.
`,

  distractor_analysis: `# Distractor analysis

## Core rule

Wrong options (**distractors**) are designed to look almost right. Eliminate choices by checking **exact wording** against the passage — especially scope (all vs some), polarity (support vs oppose), and time.

## Elimination steps

1. **Cross out** options that contradict the passage outright
2. **Compare** remaining options word-by-word with the source
3. **Watch for** partial truths — correct detail but wrong main idea
4. **Prefer** the option the passage **supports**, not what sounds logical alone

## Distractor types

| Type | Trap | Check |
|------|------|-------|
| **Opposite** | reverses yes/no | polarity words (not, unless, fail) |
| **Extreme** | all, never, always | does the passage say *all*? |
| **Out of scope** | true elsewhere, not here | only use passage evidence |
| **Same topic, wrong detail** | right name, wrong date | numbers and qualifiers |

## Common mistakes

- ❌ Choosing the option that "sounds smart"
- ❌ Ignoring *except* / *not* / *least* in the question stem
- ❌ Stopping after one keyword match without reading the full sentence

## Worked example

> **Passage:** "Most participants preferred the morning session."

> **Trap option:** "All participants preferred the morning session."

> **Why wrong:** *Most* ≠ *all* — scope changed.
`,

  inference_implied_meaning: `# Inference and implied meaning

## Core rule

**Inference** means concluding what the author **suggests** without stating directly. Use **evidence + logic** — tone, examples, and contrast words — not outside knowledge or guessing.

## Signals in the text

| Signal | May imply… |
|--------|------------|
| Tone words (unfortunately, surprisingly) | attitude or judgment |
| Examples and anecdotes | broader claim |
| Contrast (however, although) | limitation or exception |
| Modals (might, could, should) | certainty level |

## Safe inference vs overreach

| Supported inference | Overreach |
|---------------------|-----------|
| Author seems **critical** of the policy (negative adjectives) | Author **hates** the government |
| The commenter **disagrees** with the article | They will **quit** their job |

## Common mistakes

- ❌ Adding facts not in the passage
- ❌ Confusing **stated** detail with **implied** attitude
- ❌ Picking an answer that is true in real life but not supported in the text

## Worked example

> **Passage:** "The delays were 'unavoidable,' according to the spokesperson, though several customers noted otherwise."

> **Reasonable inference:** The author or customers may **doubt** the spokesperson's claim.
>
> **Not supported:** The company broke the law.
`,

  main_idea_identification: `# Main idea identification

## Core rule

The **main idea** is what the passage or paragraph is **mostly about** — not one small detail. For CELPIP, main-idea questions often use paraphrased titles or summaries.

## How to find it

1. Read the **title / first paragraph** — often states topic
2. Ask: *If I told someone one sentence about this, what would it be?*
3. Eliminate options that are **too narrow** (one example) or **too broad** (beyond the text)

## Paragraph vs passage level

| Level | Main idea is… |
|-------|----------------|
| **Paragraph** | Topic sentence + supporting points |
| **Whole passage** | Combined purpose (inform, compare viewpoints, describe a problem) |

## Common mistakes

- ❌ Choosing a detail that appears only once
- ❌ Choosing a theme bigger than the passage (e.g. "all technology is dangerous" from one product recall story)
- ❌ Confusing **main idea** with **best title** that is catchy but inaccurate

## Worked example

> **Paragraph:** Three sentences on **why** transit fares increased, one sentence listing a bus route number.

> **Main idea:** Reasons for the fare increase — **not** the bus route detail.
`,

  paraphrase_recognition: `# Paraphrase recognition

## Core rule

A **paraphrase** restates the same meaning with **different words**. CELPIP questions often use synonyms or changed grammar; the correct answer rarely copies the passage word-for-word.

## Recognition tips

| Passage may say… | Question may say… |
|------------------|-------------------|
| reduce costs | lower expenses |
| not mandatory | optional |
| prior to | before |
| a significant number of | many |

## What is NOT a paraphrase

- Same topic but **different meaning** (added *only*, *never*, *all*)
- **Opposite** polarity
- **Related** word but wrong collocation (*economic* vs *economical*)

## Common mistakes

- ❌ Matching one keyword only
- ❌ Choosing the longest option
- ❌ Ignoring small words that change meaning (*can* vs *must*)

## Worked example

> **Source:** "Applicants must submit proof of residency."

> **Paraphrase:** "Candidates are **required to provide** documentation showing they live in the area."

> **Not a paraphrase:** "Applicants **may optionally** submit proof of residency."
`,

  punctuation_mechanics: `# Punctuation and mechanics

## Core rule

Punctuation clarifies **sentence boundaries** and **relationships** between clauses. CELPIP rewards correct commas, apostrophes, and end marks — and penalizes comma splices and run-ons.

## Essentials

| Mark | Main uses |
|------|-----------|
| **Period** | End declarative sentence |
| **Comma** | Lists, after introductory phrases, before coordinating conjunction joining two independent clauses (with conjunction) |
| **Apostrophe** | Contractions (*it's* = it is), possession (*the manager's report*) |
| **Semicolon** | Join two closely related independent clauses without conjunction |

## Comma splice & run-on

| Error | Fix |
|-------|-----|
| Comma splice: *I finished, I left.* | *I finished**, and** I left.* or *I finished**;** I left.* or two sentences |
| Run-on: *The file is ready please review it* | Add period or comma + conjunction |

## Common mistakes

- ❌ *Its* vs *it's* — **it's** = it is; **its** = possession
- ❌ Comma before every *and*
- ❌ Missing apostrophe in possessives (*managers report*)

## Worked example

> **Fix:** "The report is complete, please send it to the committee."

> **Answer:** "The report is complete**; please** send it to the committee." or "**…complete. Please** send…"
`,

  sentence_variety: `# Sentence variety and complexity

## Core rule

Higher band writing mixes **simple**, **compound**, and **complex** sentences. Variety shows control; it does not mean every sentence must be long.

## Sentence types

| Type | Structure | Example |
|------|-----------|---------|
| **Simple** | one independent clause | The meeting starts at noon. |
| **Compound** | two independent clauses joined | The meeting starts at noon**, and** lunch will follow. |
| **Complex** | independent + dependent clause | **Although** traffic was heavy**,** I arrived on time. |

## Practical mix for CELPIP

- Use **short** sentences for key requests or conclusions
- Use **complex** sentences to show cause, contrast, or conditions (*because*, *although*, *if*, *when*)
- Avoid chaining many *and* clauses in one line

## Common mistakes

- ❌ Every sentence starts with *I* or *The*
- ❌ Strings of simple sentences only (*And then… And then…*)
- ❌ Over-long sentences that become hard to follow

## Worked example

> **Improve variety:** "I wrote to you. I have a question. The form is confusing. I need help."

> **Revision:** "I am writing because **the form is confusing**; **could you please clarify** which sections are mandatory?"
`,

};

function buildFallbackDocument(concept: ConceptDefinition): string {
  const examples =
    concept.examples?.map((e) => `- ${e}`).join("\n") ??
    "- (No examples recorded yet.)";

  return `# ${concept.label}

${concept.description}

## Examples

${examples}
`;
}

export function getConceptDocument(concept: ConceptDefinition): string {
  return CONCEPT_DOCUMENTS[concept.id] ?? buildFallbackDocument(concept);
}
