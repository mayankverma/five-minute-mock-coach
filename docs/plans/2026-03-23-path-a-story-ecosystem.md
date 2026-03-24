# Path A: Complete the Story Ecosystem

## Overview

Wire up gap analysis, narrative identity, story-question fit scoring, and gap-handling patterns to make the Storybank a complete coaching tool. Gaps are context-aware — they adapt based on what we know about the user (profile, resume, JD, interview schedule).

## Current State

- Gap analysis backend endpoint exists (`GET /api/stories/gaps`) but frontend returns `[]`
- Narrative identity backend endpoint exists (`GET /api/stories/narrative`) but frontend returns `''`
- Story-question fit scoring is described in prompts but not structured as output
- Gap-handling patterns (Adjacent Bridge, Hypothetical, Reframe, Growth Narrative) are not implemented
- Workspace switcher exists in the top nav but doesn't influence Storybank content

## Desired End State

The Storybank page shows:
1. Stories with fit-level indicators per workspace context (Strong / Workable / Stretch)
2. Gaps below stories with severity (Critical / Important / Nice-to-have) derived from the active workspace's JD
3. Each gap has a "Build Story" button that passes context to the StoryBuilder
4. Gaps that can be covered by reframing an existing story show "Reframe" instead of "Build"
5. Narrative identity section showing career themes when 3+ stories exist
6. When no workspace is selected (General Prep), show 8 universal categories with a nudge to add a target job

## What We're NOT Doing

- Static role-to-competency-weight matrix (competency weights are always JD-derived)
- Portfolio optimization algorithm (conflict detection, variety constraint)
- Rapid-retrieval drill
- Cross-surface earned secrets (Path B)
- Any Tier 3 items (see future-items doc)

## Data Flow: Context-Aware Gap Analysis

### Layer 0: Brand new user (no stories, no resume, no job)

Show 8 universal competency categories as a flat starting grid:
- Leadership, Conflict, Failure, Achievement, Innovation, Teamwork, Growth, Customer Focus
- No severity — just "pick one to start"
- Nudge: "Add a job you're targeting to see prioritized gaps"

### Layer 1: Has profile (seniority + target role)

Seniority band adjusts expectations (what "good" means at each level):
- Early career (0-3y): differentiation from learning velocity
- Mid-career (4-8y): requires genuine earned secrets
- Senior (8-15y): systems-level thinking, second-order effects
- Executive (15+): business-level impact, leadership philosophy

Universal categories still shown but with seniority-appropriate descriptions.

### Layer 2: Has resume

AI can suggest specific stories from their experience per gap category.
Recommendations become concrete: "Your resume mentions scaling the payments team — that's a strong Leadership story."

### Layer 3: Has job workspace with JD

Full gap analysis activates:
1. Parse JD → extract top 5-7 competencies in priority order
2. Cross-reference competencies against storybank (primary + secondary skills)
3. Classify each story as Strong Fit / Workable / Stretch / Gap
4. Classify each gap as Critical / Important / Nice-to-have
5. Prescribe gap-handling pattern per gap (Build, Reframe, Adjacent Bridge)

### Layer 4: Has interview rounds scheduled

Urgency overlay: "Your onsite is Thursday. You're missing a failure story and bar raiser rounds typically ask one."
Critical gaps connected to upcoming rounds get elevated.

## Implementation Phases

### Phase 1: Wire Up Gap Analysis Frontend

**Backend changes:**
- Modify `GET /api/stories/gaps` to accept optional `workspace_id` query param
- When `workspace_id` provided: parse JD, extract competencies, classify gaps with severity
- When no `workspace_id`: return the 8 universal categories with coverage status
- Add `fit_level` to gap response (which existing stories partially cover each gap)
- Return `gap_handling_pattern` per gap (build_new, reframe_existing, adjacent_bridge)

Response shape:
```json
{
  "coverage_score": 6,
  "mapped_stories": [
    { "story_id": "...", "title": "...", "competency": "leadership", "fit_level": "strong" }
  ],
  "gaps": [
    {
      "competency": "data-driven decision making",
      "severity": "critical",
      "reason": "JD mentions metrics-driven decisions 3 times",
      "handling_pattern": "build_new",
      "recommendation": "Build a story about using data to make a product decision",
      "closest_story": null
    },
    {
      "competency": "conflict resolution",
      "severity": "important",
      "reason": "Cross-functional role, likely to be asked",
      "handling_pattern": "reframe_existing",
      "closest_story": { "id": "...", "title": "Leading the reorg", "fit_level": "stretch" },
      "recommendation": "Your reorg story can be reframed to emphasize the conflict angle"
    }
  ]
}
```

**Frontend changes:**
- Create `useStoryGaps(workspaceId?)` hook that calls the endpoint
- Get active workspace from existing workspace context/switcher
- Render gap rows below story table in Storybank
- Render coverage score in page subtitle ("3 stories mapped, 2 gaps")
- Add fit-level badge to story rows when workspace is active

**UI: General Prep mode (no workspace)**
```
┌─────────────────────────────────────────────────────────────┐
│ GETTING STARTED                                              │
│                                                              │
│ Strong candidates need stories across these areas.           │
│ You have 1 of 8 covered.                                     │
│                                                              │
│ ✅ Customer Focus    ○ Leadership       ○ Conflict           │
│ ○ Teamwork           ○ Failure          ○ Innovation         │
│ ○ Achievement        ○ Growth                                │
│                                                              │
│ 💡 Add a target job to see which gaps matter most for you    │
└─────────────────────────────────────────────────────────────┘
```

**UI: Workspace active**
```
┌─────────────────────────────────────────────────────────────┐
│ Storybank                          Context: Stripe PM ▼      │
│ 3 stories mapped, 2 gaps identified                          │
├─────────────────────────────────────────────────────────────┤
│ 3/23  One finance truth...   Customer Focus  ●●●●○  Strong  │
│ 3/22  Leading the reorg      Leadership      ●●●○○  Workable│
│ 3/20  Scaling the team        Collaboration  ●●●●○  Strong  │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│ 🔴 Critical  Data-driven decisions           [Build Story]   │
│              "JD emphasizes metrics-driven product decisions" │
│ 🟡 Important Conflict resolution             [Reframe]       │
│              "Reorg story covers this with framing guidance"  │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Gap-Handling Coach

When a user clicks "Build Story" on a gap:
- Open StoryBuilder with gap context passed as props
- Opening message references the gap: "You need a story about data-driven decision making for the Stripe PM role. Think about a time you used data to make a key product call..."
- If "Reframe" is clicked: open StoryBuilder with the closest story pre-loaded and a specific reframing prompt

When handling pattern is "adjacent_bridge":
- Coach teaches the bridging technique: "You don't have a direct conflict story, but your reorg experience has a conflict element. Let me help you frame it..."

Add the four gap-handling patterns to the story_chat.txt prompt so the AI knows how to coach each one.

### Phase 3: Story-Question Fit Scoring

**Backend changes:**
- Create `GET /api/stories/mapping?workspace_id=...` endpoint
- For each story in the storybank, classify against the workspace's JD competencies:
  - Strong Fit: primary skill matches, strength 4+, domain aligned
  - Workable: secondary skill match, or primary with strength 3
  - Stretch: reframeable but requires bridging
  - Gap: no story addresses this competency
- Return structured mapping table

**Frontend changes:**
- When a workspace is active, show fit-level badge on each story row
- Accordion expansion shows "Mapped to: influence (Strong), conflict (Stretch)"
- Prep page can reference this mapping for interview preparation

### Phase 4: Narrative Identity

**Backend changes:**
- The `GET /api/stories/narrative` endpoint already exists (requires 3+ stories)
- Enhance the prompt to return structured output: core themes, sharpest edge, orphan stories, fragile themes

**Frontend changes:**
- Create `useNarrativeIdentity()` hook
- Show narrative identity card below the gaps section when 3+ stories exist
- Display: 2-3 core themes, the "sharpest edge" (most distinctive theme), orphan stories not connected to themes

```
┌─────────────────────────────────────────────────────────────┐
│ 🧭 NARRATIVE IDENTITY                                        │
│                                                              │
│ Core themes:                                                 │
│ • Building systems where none existed                        │
│ • Turning ambiguity into clarity for executives              │
│                                                              │
│ Sharpest edge:                                               │
│ "You thrive in 0-to-1 data infrastructure — most people      │
│  optimize existing systems, you create them from scratch"     │
│                                                              │
│ ⚠ Orphan: "Mentoring junior engineers" doesn't connect       │
│   to either theme. Consider retiring or strengthening.        │
└─────────────────────────────────────────────────────────────┘
```

## Gap-Handling Patterns Reference

When prescribing a handling pattern per gap:

| Story Coverage | Handling Pattern | UI Action |
|----------------|-----------------|-----------|
| No story at all | Build New | "Build Story" → fresh StoryBuilder with gap context |
| Existing story, stretch fit | Reframe Existing | "Reframe" → StoryBuilder with story loaded + reframing prompt |
| Adjacent experience (secondary skill) | Adjacent Bridge | "Bridge" → StoryBuilder with closest story + bridging prompt |
| Known development area | Growth Narrative | "Build Story" with growth framing prompt |
| No story, no adjacent experience | Hypothetical | Flag as "prepare a hypothetical response" with coaching |

## Testing Strategy

### Playwright E2E
- General Prep mode shows 8 universal categories
- Switching workspace triggers gap recalculation
- "Build Story" on a gap opens StoryBuilder with context
- Fit-level badges appear on stories when workspace is active
- Narrative identity card appears with 3+ stories

### Manual Testing
- Parse a real JD and verify competency extraction makes sense
- Verify severity classification (Critical/Important/Nice-to-have) matches intuition
- Test gap-handling pattern coaching (reframe, adjacent bridge)
- Test narrative identity themes with diverse storybanks

## Dependencies

- Workspace switcher must pass active workspace ID to Storybank
- JD must be stored in the job_workspace record (already exists)
- Story skill tags should ideally be standardized (currently freeform) — but AI can fuzzy-match for now

## Migration Notes

- No schema changes needed — uses existing tables (story, job_workspace)
- Gap analysis is computed on-the-fly, no new tables
- Narrative identity is computed on-the-fly
- Story-question mapping is computed on-the-fly
