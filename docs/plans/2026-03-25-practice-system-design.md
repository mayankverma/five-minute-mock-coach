# Practice System Design

## Overview

The practice system trains users to answer behavioral interview questions through deliberate repetition, scored feedback, and progressive skill building. It shares a scoring engine and question sources with Mock Interview but serves a different purpose: Practice is the gym, Mock Interview is the scrimmage.

**Practice** = answer a question, get feedback, try again until solid.
**Mock Interview** = simulate a full interview, get a holistic debrief at the end.

---

## Architecture

### Two Tabs, Shared Engine

| | Practice | Mock Interview |
|---|---|---|
| Purpose | Train individual answers through repetition | Simulate real interview conditions |
| Core loop | Answer, feedback, try again / shuffle | Answer all questions, debrief at end |
| Per-question feedback | Yes (condensed score + tip) | No (realistic simulation) |
| End-of-session feedback | Pattern/theme summary (sessions only) | Full debrief: per-Q scores revealed together, arc analysis, hire signal, interviewer's inner monologue, top 3 changes |
| Formats | Atomic, Session, Round Prep | Behavioral Screen, Deep Behavioral, System Design, Panel, Bar Raiser, Technical+Behavioral |

### Practice Modes

**Quick Practice** (default) — smart queue, no progression required, anyone can use anytime.

**Guided Program** — 8-stage drill progression with earned soft gates.

---

## Quick Practice

### Three Tiers

| | Atomic | Session | Round Prep |
|---|---|---|---|
| When | Daily 5-min habit | Focused practice block | Before a specific interview round |
| Questions | 1 (iterate on it) | 5 (iterate on each) | 4-6 matched to round format |
| Source weighting | Smart queue picks best question | Mix across 4 sources | Heavily job-specific + round-relevant |
| End summary | Per-attempt improvement tracking | Pattern debrief | Theme debrief |
| Access | Practice tab | Practice tab | Practice tab + workspace shortcut |

### Core Loop

1. User receives a question.
2. User answers (voice or text; voice preferred).
3. System scores and shows condensed feedback.
4. User chooses:
   - **Try Again** — same question, same phrasing. Refine the answer based on feedback.
   - **Shuffle** — same competency, different phrasing. Tests flexibility with the same story. Subtitle: "Interviewers ask the same thing differently. Shuffle tests your flexibility with the same story."
   - **Next Question** — move to a different topic entirely.
5. Repeat.

### Feedback Layers

**Condensed view (default):** Overall score (single number out of 5) + one coaching tip + hire signal.

**Expanded view (one tap — "See full breakdown"):**
- 5 dimension score bars (Substance, Structure, Relevance, Credibility, Differentiation)
- Presence score (6th dimension, shown only when voice input used)
- 3-5 actionable coaching bullets

**Depth tabs (progressive disclosure):**
- Coaching Notes tab (default active) — actionable bullets
- Exemplar Answer tab — 170-260 word sample showing what a great answer sounds like for this specific question
- Quick Drill tab — 1-minute focused exercise targeting the weakest dimension

### Feedback Scaling by Question Count

| Questions answered | Feedback type | Example |
|---|---|---|
| 1 (Atomic) | Pinpoint | "Your Result lacked a metric." |
| 5 (Session) | Pattern | "You defaulted to 'we' in 4 of 5 answers — Credibility suffers when your individual contribution is unclear." |
| 4-6 (Round Prep) | Theme + gap | "A team management interviewer would walk away convinced you execute well but unsure if you develop talent. Your storybank has no mentorship stories." |

### Daily Practice (Formal Feature)

Atomic practice is positioned as a daily 5-minute habit:
- Email nudges and in-app prompts to practice daily
- Streak tracking (consecutive days practiced)
- Smart question selection: system picks the single best question for the user today based on gaps, recency, and upcoming interviews

---

## Question Sources

### Four Sources

| Source | What it is | Generation method |
|---|---|---|
| **A. Bank** | 253 behavioral questions with themes, difficulty, company overlays, variations, follow-ups | Pre-existing in `question` table |
| **B. Job-specific** | Predicted questions from JD decode + interviewer concerns | Pre-generated during JD decode, stored in `prepared_questions[]` on workspace. Refreshed when JD is updated. |
| **C. Story-specific** | Questions testing whether you can deploy stories against various angles | Pre-generated (3-5 questions + variations) when a story is created or updated. Stored on the story. Refreshed when story is edited or new version created. |
| **D. Resume-gap** | Questions targeting weaknesses: career narrative gaps, missing competencies, low-score areas | Pre-generated during resume analysis. Stored on resume_analysis. Refreshed when resume is re-analyzed. |

### Hybrid Generation Strategy

Questions from sources B, C, and D follow a hybrid approach:

1. **Pre-generate a base set** when the triggering event occurs (story created, JD decoded, resume analyzed).
2. **Store with IDs** so they integrate with `user_question_history` tracking.
3. **Refresh** when source data changes.
4. **Backfill on-the-fly** when the stored pool is exhausted — AI generates fresh questions and appends them to the stored set.

This ensures practice loads instantly (no generation delay), history tracking works, the pool stays fresh, and it never runs dry.

### Context-Weighted Selection Algorithm

When the system picks a question, it weights sources based on user context:

| User context | Bank (A) | Job-specific (B) | Story-specific (C) | Resume-gap (D) |
|---|---|---|---|---|
| No workspace, no stories, no resume | 100% | — | — | — |
| Has stories, no workspace | 50% | — | 30% | 20% |
| Has active workspace | 25% | 40% | 20% | 15% |
| Interviewing soon (next_round_date within 7 days) | 10% | 60% | 20% | 10% |

Users can override with filters: "Job-specific only," "Leadership theme," "Story drills," etc.

### Source Indicator

Each question shows a subtle colored dot indicating its source. Tapping the dot reveals context:

- Blue dot — "From question bank — high frequency, asked at 34 companies"
- Green dot — "Based on your JD — tests cross-functional leadership, your #2 ranked competency at Google"
- Purple dot — "Tests your story: Leading the API Migration — can you deploy it against this angle?"
- Orange dot — "Targets a gap — your resume shows no mentorship experience, a key competency for this role"

Default: dot only (clean UI). Tap for explanation (builds trust in the system's reasoning).

---

## Scoring

### Five Core Dimensions (1-5 scale)

1. **Substance** — specific, quantified evidence; alternatives considered; depth of reasoning
2. **Structure** — STAR clarity, narrative flow, setup to conflict to resolution to impact
3. **Relevance** — directly addresses what was asked; every sentence serves the answer
4. **Credibility** — first-person detail; acknowledges tradeoffs; interviewer believes it
5. **Differentiation** — would another candidate say the same thing? Earned insights, unique perspective

### Presence (6th Dimension, Voice-Only)

When the user records a voice answer, the system also scores:

6. **Presence** — pace, filler words, hedging, confidence in delivery

Shown only when voice input is used. Not scored for text answers.

### Hire Signal

Each scored answer receives a hire signal: Strong Hire / Hire / Mixed / No Hire.

### Attempt Tracking

When a user iterates on the same question (Try Again), each attempt is scored separately. The UI shows improvement across attempts: "Attempt 1: 2.8 → Attempt 2: 3.4 → Attempt 3: 3.9"

---

## Guided Program

### 8-Stage Drill Progression

| Stage | Drill | What it tests | Gate to advance | Prerequisites |
|---|---|---|---|---|
| 1 | Ladder | Structure an answer at different time constraints (30s, 60s, 90s, 3min) | Structure >= 3 on 3 consecutive rounds | None |
| 2 | Pushback | Handle skepticism, interruption, "so what?" pressure | Credibility >= 3 under pressure | Stage 1 |
| 3 | Pivot | Redirect when the question doesn't match your prep | Relevance >= 3 when redirected | Stage 2 |
| 4 | Gap | Handle "I don't have an example for that" gracefully | Credibility >= 3 with honest gap handling | Stage 2 |
| 5 | Role | Handle role-specific specialist scrutiny (PM 6-lens, engineer depth, etc.) | Substance >= 3 under specialist scrutiny | Stages 1-3 |
| 6 | Panel | Manage multiple interviewer personas simultaneously | All dimensions >= 3 with multiple personas | Stages 1-4 |
| 7 | Stress | Perform under maximum pressure (time crunch, hostility, curveballs) | All dimensions >= 3 under maximum pressure | Stages 1-5 |
| 8 | Technical (optional) | Think out loud, seek clarification, articulate tradeoffs | Structure + Substance >= 3 in technical communication | Stages 1-3 |

### Dependency Tree

```
Stage 1 (Ladder) — foundation for everything
  |-- Stage 2 (Pushback) — adds pressure
  |     |-- Stage 3 (Pivot) — adds adaptability
  |     |-- Stage 4 (Gap) — adds honesty under pressure
  |           |-- Stage 5 (Role) — needs 1-3, adds specialist depth
  |                 |-- Stage 6 (Panel) — needs 1-4, adds multiplayer
  |                       |-- Stage 7 (Stress) — needs 1-5, max difficulty
  |-- Stage 8 (Technical) — needs 1-3, optional side track
```

### Gating: Earned Progression with Informed Override

Stages unlock sequentially. Users must earn progression by meeting score thresholds.

If a user attempts to skip ahead, the system warns:
> "Your Structure scores are at 2.5 — Pushback drills build on that foundation. I'd recommend mastering Ladder first. Jump ahead anyway?"

The user can override, but:
- The system records that they skipped.
- Skipped stages remain unmastered.
- A "Mastered" badge appears only when a stage is properly completed through the gate.

### Question Sources in Guided Program

Guided Program stages pull from all 4 question sources, weighted the same as Quick Practice. The stage determines the *drill format* (pushback pressure, pivot redirects, etc.), not the question source. A Stage 2 (Pushback) drill might use a job-specific question — the pushback challenge is layered on top.

### Warmup Round

The first round of every Guided Program session is unscored:
- "This first one is a warmup — I won't score it. Just get your thoughts flowing."
- Easy, open-ended question related to the drill type.
- Brief encouraging feedback, no scoring.
- Then: "Good, you're warmed up. From here on I'll score each round."

---

## Round Prep

### What It Is

A practice session constructed around a specific upcoming interview round. Accessible from the Practice tab ("Round Prep" tier) or from a "Practice this round" button in the job workspace.

### How It Works

1. System reads the workspace's round format, competencies, and predicted questions for the target round.
2. Constructs 4-6 questions weighted toward that round's predicted competencies.
3. User answers each with the standard core loop (answer, feedback, try again / shuffle / next).
4. At the end, delivers a theme debrief evaluating readiness for that specific round.

### Theme Debrief

The theme debrief evaluates the user as a candidate for that round, not just per-question:
- Competency coverage: which competencies were demonstrated, which were missing
- Story diversity: did the user rely on the same story repeatedly?
- Gap identification: what would the interviewer walk away uncertain about?
- Readiness assessment: ready / needs work / not ready, with specific actions

---

## Mock Interview

### What It Is

A full interview simulation. No per-question feedback. Holistic debrief at the end.

### Formats

| Format | Questions | Duration | Description |
|---|---|---|---|
| Behavioral Screen | 4 | 30 min | Recruiter-style assessment |
| Deep Behavioral | 6 | 45 min | Hiring manager depth |
| System Design | 4 | 60 min | Communication-focused |
| Panel | 5 | 45 min | Multiple interviewer personas |
| Bar Raiser | 6 | 50 min | High-pressure differentiation |
| Technical + Behavioral | 5 | 45 min | Mixed format, mode-switching |

### Question Sources

Mock Interview pulls from the same 4 sources with the same context-weighted algorithm. If a workspace is active, questions align with that job's competencies and format.

### Full Debrief

Delivered at the end of the mock session:

- **Per-question scores** — all 5 dimensions revealed at once (not during the interview)
- **Arc analysis** — energy trajectory across questions, pacing, answer length distribution
- **Story diversity** — did the user repeat stories? Did they cover enough competencies?
- **Holistic patterns** — crutch phrases, topics avoided, best and worst moments, recovery quality
- **Interviewer's inner monologue** — how the sequence of answers built or eroded confidence. Example: "Your first 3 answers were strong but all technical. By question 4, I was wondering if you can lead people."
- **Hire signal** — Strong Hire / Hire / Mixed / No Hire
- **Top 3 changes** — the three highest-impact improvements for next time

---

## Input Modes

### Voice (Preferred)

Users record their answer via the VoiceRecorder component. Voice answers:
- Score all 6 dimensions (including Presence)
- Better simulate real interview conditions
- Are transcribed for AI scoring

### Text

Users type their answer. Text answers:
- Score 5 dimensions (Presence not applicable)
- Useful for users who want to draft and refine phrasing
- Lower barrier for quick practice

Both modes are always available. The UI presents voice as the primary input with text as a visible alternative.

---

## Data Model Changes

### New: Story Questions

When a story is created or updated, generate 3-5 practice questions + variations. Store on the story:

```
story_question:
  id, story_id, question_text, variations[], competency_tested, created_at
```

### New: Gap Questions

When resume is analyzed, generate questions targeting identified gaps. Store on the analysis:

```
gap_question:
  id, resume_analysis_id, question_text, variations[], gap_targeted, created_at
```

### Existing Tables (Extended)

- `user_question_history` — add source field (bank / job_specific / story_specific / resume_gap) and attempt_number for try-again tracking
- `score_entry` — add attempt_number, input_mode (voice / text), presence_score (nullable)
- `drill_progression` — implement stage advancement logic using existing schema (current_stage, gates_passed, revisit_queue)
- `practice_session` — add tier field (atomic / session / round_prep) and round_id (nullable, for round prep)

### Daily Practice Tracking

```
daily_practice:
  user_id, practice_date, questions_answered, streak_count, updated_at
```

---

## Question Variation & Shuffle

Every question — whether from the bank, job-specific, story-specific, or resume-gap — has variations (alternate phrasings testing the same competency).

- **Bank questions**: 3+ pre-built variations per question in the existing data.
- **Generated questions** (sources B, C, D): AI generates 2-3 variations alongside the base question during pre-generation.
- **On-the-fly fallback**: If variations are exhausted, AI generates a fresh rephrasing.

When the user taps **Shuffle**, the system serves a variation of the current question. The competency tested stays the same; the phrasing changes. This trains the user to deploy the same story regardless of how the question is framed.

---

## Integration Points

### Practice Tab to Workspace

Round Prep sessions are accessible from both:
- Practice tab: user selects "Round Prep," picks a workspace and round
- Workspace page: "Practice this round" button next to interview round details

Both launch the same experience.

### Practice to Progress

All scores (from Practice and Mock) feed into the Progress tab:
- Dimension trends over time
- Calibration tracking (self-assessment vs. coach score)
- Pattern detection (recurring strengths and weaknesses)
- Drill progression status

### Practice to Story Builder

When practice feedback identifies a story gap ("You have no mentorship story"), the system can suggest: "Want to build a story for this? → Story Builder."

### Practice to Mock Interview

Round Prep and Mock Interview for the same round use the same question pool. The difference is feedback timing:
- Round Prep: per-question feedback (learning mode)
- Mock Interview: end-of-session debrief (simulation mode)
