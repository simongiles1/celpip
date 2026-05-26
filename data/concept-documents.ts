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
