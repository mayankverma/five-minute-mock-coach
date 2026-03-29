# Practice System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the full Practice system with 4 question sources, 3 tiers (Atomic/Session/Round Prep), 8-stage Guided Program, and enhanced scoring — as specified in `docs/plans/2026-03-25-practice-system-design.md`.

**Architecture:** Backend-first approach. New DB tables for generated questions, daily tracking, and extended scoring. New question generation service that pre-generates story-specific and resume-gap questions. Overhauled question selection service with context-weighted 4-source algorithm. Enhanced scoring engine with presence dimension, exemplar answers, and micro-drills. Frontend rebuilt with two-mode Practice page (Quick Practice + Guided Program) and enhanced Scorecard with progressive disclosure.

**Tech Stack:** FastAPI, Supabase (Postgres), OpenAI (gpt-4o), React 19, TypeScript, React Query, Axios

**Branch:** `feature/practice-system`

---

## Phase 1: Database Foundation

### Task 1: Migration — New Tables and Column Extensions

**Files:**
- Create: `backend/db/migrations/009_practice_system.sql`

**Step 1: Write the migration SQL**

```sql
-- 009_practice_system.sql
-- Practice system: generated questions, daily tracking, scoring extensions

-- Story-specific generated questions
CREATE TABLE story_question (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES story(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    variations TEXT[] DEFAULT '{}',
    competency_tested TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_story_question_story ON story_question(story_id);

ALTER TABLE story_question ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_question_user ON story_question
  FOR ALL USING (story_id IN (SELECT id FROM story WHERE user_id = auth.uid()));

-- Resume-gap generated questions
CREATE TABLE gap_question (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resume_analysis_id UUID,
    question_text TEXT NOT NULL,
    variations TEXT[] DEFAULT '{}',
    gap_targeted TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gap_question_user ON gap_question(user_id);

ALTER TABLE gap_question ENABLE ROW LEVEL SECURITY;
CREATE POLICY gap_question_user ON gap_question
  FOR ALL USING (user_id = auth.uid());

-- Daily practice streak tracking
CREATE TABLE daily_practice (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    practice_date DATE NOT NULL,
    questions_answered INTEGER DEFAULT 0,
    streak_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, practice_date)
);

ALTER TABLE daily_practice ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_practice_user ON daily_practice
  FOR ALL USING (user_id = auth.uid());

-- Extend practice_session with tier and round_id
ALTER TABLE practice_session
  ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('atomic', 'session', 'round_prep')) DEFAULT 'atomic',
  ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES interview_round(id) ON DELETE SET NULL;

-- Extend score_entry with attempt tracking, input mode, presence
ALTER TABLE score_entry
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS input_mode TEXT CHECK (input_mode IN ('voice', 'text')) DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS presence NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS question_id UUID;

-- Extend user_question_history with source tracking
ALTER TABLE user_question_history
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'bank';
```

**Step 2: Apply the migration**

Run: `cd /Users/mayankverma/Desktop/MayankApps/five-minute-mock-coach && cat backend/db/migrations/009_practice_system.sql`

Verify the SQL is correct, then apply via Supabase MCP tool `apply_migration`.

**Step 3: Commit**

```bash
git add backend/db/migrations/009_practice_system.sql
git commit -m "feat: add practice system migration — story_question, gap_question, daily_practice tables

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: Question Generation Service

### Task 2: Question Generation Service

Generates practice questions from stories and resume gaps. Called when stories are created/updated or resumes are analyzed.

**Files:**
- Create: `backend/api/services/question_generator.py`

**Step 1: Write the service**

```python
"""Question generation service — creates practice questions from stories and resume gaps."""

import json
from backend.api.db.client import get_supabase
from backend.api.services.ai_coach import AICoachService


class QuestionGenerator:
    """Generates practice questions from stories, resume gaps, and job context."""

    def __init__(self):
        self.coach = AICoachService()

    async def generate_story_questions(
        self,
        story: dict,
        user_context: dict,
        count: int = 5,
    ) -> list[dict]:
        """Generate practice questions that test a specific story.

        Called when a story is created or updated.
        Deletes existing story_questions for this story and regenerates.
        """
        db = get_supabase()
        story_id = story["id"]

        message = (
            f"## Story\n"
            f"**Title:** {story.get('title', 'Untitled')}\n"
            f"**Primary Skill:** {story.get('primary_skill', 'N/A')}\n"
            f"**Secondary Skill:** {story.get('secondary_skill', 'N/A')}\n"
            f"**Situation:** {story.get('situation', 'N/A')}\n"
            f"**Action:** {story.get('action', 'N/A')}\n"
            f"**Result:** {story.get('result', 'N/A')}\n"
            f"**Deploy For:** {story.get('deploy_for', 'N/A')}\n"
            f"\n## Instructions\n"
            f"Generate {count} behavioral interview questions that this story could answer. "
            f"Each question should test the story from a different angle — different competencies, "
            f"framings, or levels of difficulty. For each question, also provide 2-3 variations "
            f"(alternate phrasings testing the same thing).\n\n"
            f"Return JSON array: ["
            f'{{"question_text": "...", "variations": ["...", "..."], "competency_tested": "..."}}'
            f", ...]"
        )

        raw = await self.coach.coach_json("practice", user_context, message)
        questions = json.loads(raw)

        if isinstance(questions, dict) and "questions" in questions:
            questions = questions["questions"]

        # Delete existing questions for this story
        db.table("story_question").delete().eq("story_id", story_id).execute()

        # Insert new questions
        rows = []
        for q in questions[:count]:
            rows.append({
                "story_id": story_id,
                "question_text": q.get("question_text", ""),
                "variations": q.get("variations", []),
                "competency_tested": q.get("competency_tested", ""),
            })

        if rows:
            resp = db.table("story_question").insert(rows).execute()
            return resp.data or []
        return []

    async def generate_gap_questions(
        self,
        user_id: str,
        gaps: list[str],
        user_context: dict,
        resume_analysis_id: str | None = None,
        count: int = 5,
    ) -> list[dict]:
        """Generate practice questions targeting resume/story gaps.

        Called when resume analysis identifies career narrative gaps
        or story gap analysis finds missing competencies.
        """
        db = get_supabase()

        gap_list = "\n".join(f"- {g}" for g in gaps)
        message = (
            f"## Career Gaps Identified\n{gap_list}\n\n"
            f"## Instructions\n"
            f"Generate {count} behavioral interview questions that specifically target these gaps. "
            f"These are areas where the candidate lacks stories or evidence. "
            f"Questions should expose the gap so the candidate can practice handling it — "
            f"either by building a new story or practicing gap-handling patterns "
            f"(adjacent bridge, hypothetical, reframe, growth narrative).\n\n"
            f"For each question, provide 2-3 variations.\n\n"
            f"Return JSON array: ["
            f'{{"question_text": "...", "variations": ["...", "..."], "gap_targeted": "..."}}'
            f", ...]"
        )

        raw = await self.coach.coach_json("practice", user_context, message)
        questions = json.loads(raw)

        if isinstance(questions, dict) and "questions" in questions:
            questions = questions["questions"]

        # Delete existing gap questions for this user
        db.table("gap_question").delete().eq("user_id", user_id).execute()

        rows = []
        for q in questions[:count]:
            rows.append({
                "user_id": user_id,
                "resume_analysis_id": resume_analysis_id,
                "question_text": q.get("question_text", ""),
                "variations": q.get("variations", []),
                "gap_targeted": q.get("gap_targeted", ""),
            })

        if rows:
            resp = db.table("gap_question").insert(rows).execute()
            return resp.data or []
        return []

    async def generate_variations(
        self,
        question_text: str,
        user_context: dict,
        count: int = 3,
    ) -> list[str]:
        """Generate fresh variations of a question on-the-fly.

        Used as backfill when stored variations are exhausted.
        """
        message = (
            f"## Original Question\n{question_text}\n\n"
            f"## Instructions\n"
            f"Generate {count} alternative phrasings of this interview question. "
            f"Each should test the same competency but be worded differently — "
            f"as different interviewers might ask the same thing.\n\n"
            f'Return JSON array of strings: ["variation 1", "variation 2", ...]'
        )

        raw = await self.coach.coach_json("practice", user_context, message)
        variations = json.loads(raw)

        if isinstance(variations, dict) and "variations" in variations:
            variations = variations["variations"]

        return variations[:count] if isinstance(variations, list) else []
```

**Step 2: Commit**

```bash
git add backend/api/services/question_generator.py
git commit -m "feat: add question generation service for story-specific and gap questions

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Hook Question Generation into Story and Resume Flows

When a story is created/updated, auto-generate story questions. When resume analysis produces gaps, auto-generate gap questions.

**Files:**
- Modify: `backend/api/routers/stories.py` — after story creation/update in chat endpoint
- Modify: `backend/api/routers/resume.py` — after resume analysis

**Step 1: Add story question generation trigger to stories router**

In `backend/api/routers/stories.py`, after the story is created/updated in the chat streaming endpoint (after `event: story_complete` handling), add a background call to generate story questions:

```python
# At top of file, add import:
from backend.api.services.question_generator import QuestionGenerator
question_generator = QuestionGenerator()

# Inside the event_stream() function, after story is created/updated and version is saved:
# (after the version_created yield, before the done yield)
try:
    story_for_gen = db.table("story").select("*").eq("id", story_id).maybe_single().execute()
    if story_for_gen.data:
        await question_generator.generate_story_questions(story_for_gen.data, user_context)
except Exception:
    pass  # Don't fail the stream if question generation fails
```

**Step 2: Add gap question generation trigger to resume router**

In `backend/api/routers/resume.py`, find the endpoint that performs resume analysis. After `resume_analysis_v2` is saved, check for `career_narrative_gaps` and generate gap questions:

```python
# At top of file, add import:
from backend.api.services.question_generator import QuestionGenerator
question_generator = QuestionGenerator()

# After resume analysis is saved:
gaps = analysis_result.get("career_narrative_gaps") or []
if gaps:
    try:
        user_context = await coach.build_user_context(user.id)
        await question_generator.generate_gap_questions(
            user_id=user.id,
            gaps=gaps,
            user_context=user_context,
            resume_analysis_id=analysis_resp.data[0]["id"] if analysis_resp.data else None,
        )
    except Exception:
        pass
```

**Step 3: Commit**

```bash
git add backend/api/routers/stories.py backend/api/routers/resume.py
git commit -m "feat: auto-generate practice questions when stories or resumes are updated

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3: Question Selection Algorithm

### Task 4: Overhaul QuestionService with 4-Source Weighted Selection

Replace the existing single-source question selection with the context-weighted 4-source algorithm.

**Files:**
- Modify: `backend/api/services/question_service.py`

**Step 1: Rewrite QuestionService**

Replace the entire file content:

```python
"""Question selection service — context-weighted selection across 4 sources."""

import random
from typing import Optional
from backend.api.db.client import get_supabase


# Drill stage configs for Guided Program
STAGE_CONFIG = {
    1: {"difficulty": "medium", "time_limit": 120, "name": "Ladder", "gate_dim": "structure", "gate_score": 3.0},
    2: {"difficulty": "medium", "include_followups": True, "name": "Pushback", "gate_dim": "credibility", "gate_score": 3.0},
    3: {"difficulty": "medium", "name": "Pivot", "gate_dim": "relevance", "gate_score": 3.0},
    4: {"difficulty": "medium", "name": "Gap", "gate_dim": "credibility", "gate_score": 3.0},
    5: {"filter_by_role": True, "name": "Role", "gate_dim": "substance", "gate_score": 3.0},
    6: {"difficulty": "hard", "name": "Panel", "gate_dim": "all", "gate_score": 3.0},
    7: {"difficulty": "hard", "time_limit": 90, "name": "Stress", "gate_dim": "all", "gate_score": 3.0},
    8: {"difficulty": "hard", "include_followups": True, "name": "Technical", "gate_dim": "structure,substance", "gate_score": 3.0},
}

# Source weights by user context
SOURCE_WEIGHTS = {
    "no_context":       {"bank": 1.0,  "job": 0.0, "story": 0.0, "gap": 0.0},
    "has_stories":      {"bank": 0.5,  "job": 0.0, "story": 0.3, "gap": 0.2},
    "has_workspace":    {"bank": 0.25, "job": 0.4, "story": 0.2, "gap": 0.15},
    "interview_soon":   {"bank": 0.1,  "job": 0.6, "story": 0.2, "gap": 0.1},
}


class QuestionService:
    """Selects questions from 4 sources with context-weighted algorithm."""

    async def get_questions(
        self,
        user_id: str,
        workspace_id: Optional[str] = None,
        theme: Optional[str] = None,
        difficulty: Optional[str] = None,
        count: int = 3,
        stage: Optional[int] = None,
        source_filter: Optional[str] = None,
    ) -> list[dict]:
        """Select questions weighted across 4 sources.

        Sources:
          A. Bank — 253 behavioral questions
          B. Job-specific — prepared_questions from workspace
          C. Story-specific — generated from storybank
          D. Resume-gap — generated from resume analysis gaps
        """
        db = get_supabase()

        # Apply stage config overrides
        if stage and stage in STAGE_CONFIG:
            config = STAGE_CONFIG[stage]
            difficulty = difficulty or config.get("difficulty")

        # Get recently practiced question IDs to deprioritize
        recent_resp = (
            db.table("user_question_history")
            .select("question_id")
            .eq("user_id", user_id)
            .order("last_practiced", desc=True)
            .limit(20)
            .execute()
        )
        recent_ids = {r["question_id"] for r in (recent_resp.data or [])}

        # Determine context level for weighting
        context_level = self._determine_context(db, user_id, workspace_id)

        # If user set a source filter, override weights
        if source_filter:
            weights = {"bank": 0.0, "job": 0.0, "story": 0.0, "gap": 0.0}
            weights[source_filter] = 1.0
        else:
            weights = SOURCE_WEIGHTS[context_level].copy()

        # Collect candidate questions from each source
        candidates: list[dict] = []

        # Source A: Bank
        if weights["bank"] > 0:
            bank_count = max(1, round(count * 3 * weights["bank"]))
            bank_qs = await self._get_bank_questions(
                db, user_id, workspace_id, theme, difficulty, bank_count, recent_ids
            )
            for q in bank_qs:
                q["_source"] = "bank"
                q["_source_detail"] = self._bank_detail(q)
            candidates.extend(bank_qs)

        # Source B: Job-specific
        if weights["job"] > 0 and workspace_id:
            job_count = max(1, round(count * 3 * weights["job"]))
            job_qs = await self._get_job_questions(db, workspace_id, job_count, recent_ids)
            for q in job_qs:
                q["_source"] = "job_specific"
            candidates.extend(job_qs)

        # Source C: Story-specific
        if weights["story"] > 0:
            story_count = max(1, round(count * 3 * weights["story"]))
            story_qs = await self._get_story_questions(db, user_id, story_count, recent_ids)
            for q in story_qs:
                q["_source"] = "story_specific"
            candidates.extend(story_qs)

        # Source D: Resume-gap
        if weights["gap"] > 0:
            gap_count = max(1, round(count * 3 * weights["gap"]))
            gap_qs = await self._get_gap_questions(db, user_id, gap_count, recent_ids)
            for q in gap_qs:
                q["_source"] = "resume_gap"
            candidates.extend(gap_qs)

        # Weighted random selection from candidates
        if not candidates:
            return []

        # Assign selection weight based on source
        for c in candidates:
            src = c["_source"]
            src_key = {"bank": "bank", "job_specific": "job", "story_specific": "story", "resume_gap": "gap"}[src]
            c["_weight"] = weights.get(src_key, 0.1)
            # Deprioritize recently practiced
            if c.get("id") in recent_ids:
                c["_weight"] *= 0.1

        # Weighted sample without replacement
        selected = []
        remaining = list(candidates)
        for _ in range(min(count, len(remaining))):
            total_weight = sum(c["_weight"] for c in remaining)
            if total_weight == 0:
                break
            r = random.random() * total_weight
            cumulative = 0
            for i, c in enumerate(remaining):
                cumulative += c["_weight"]
                if cumulative >= r:
                    selected.append(c)
                    remaining.pop(i)
                    break

        return selected

    def _determine_context(self, db, user_id: str, workspace_id: Optional[str]) -> str:
        """Determine which weight profile to use based on user context."""
        if workspace_id:
            # Check if interview is soon
            ws = (
                db.table("job_workspace")
                .select("next_round_date")
                .eq("id", workspace_id)
                .maybe_single()
                .execute()
            )
            if ws.data and ws.data.get("next_round_date"):
                from datetime import datetime, timedelta, timezone
                try:
                    nrd = datetime.fromisoformat(ws.data["next_round_date"].replace("Z", "+00:00"))
                    if nrd - datetime.now(timezone.utc) <= timedelta(days=7):
                        return "interview_soon"
                except (ValueError, TypeError):
                    pass
            return "has_workspace"

        # Check if user has stories
        story_count = (
            db.table("story")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("status", "active")
            .execute()
        )
        if story_count.count and story_count.count > 0:
            return "has_stories"

        return "no_context"

    async def _get_bank_questions(
        self, db, user_id, workspace_id, theme, difficulty, count, recent_ids
    ) -> list[dict]:
        """Source A: questions from the 253-question bank."""
        query = db.table("question").select("*")
        if theme:
            query = query.eq("theme", theme)
        if difficulty:
            query = query.eq("difficulty", difficulty)

        # If workspace, prioritize company-mapped questions
        if workspace_id:
            ws = db.table("job_workspace").select("company_name").eq("id", workspace_id).maybe_single().execute()
            if ws.data:
                company_key = ws.data["company_name"].lower().replace(" ", "_")
                cq = (
                    db.table("question_company_map")
                    .select("question_id")
                    .eq("company_key", company_key)
                    .limit(count)
                    .execute()
                )
                company_ids = [r["question_id"] for r in (cq.data or [])]
                if company_ids:
                    prio = db.table("question").select("*").in_("id", company_ids[:count]).execute()
                    return prio.data or []

        result = query.limit(count).execute()
        return result.data or []

    def _bank_detail(self, q: dict) -> str:
        """Build source detail string for bank questions."""
        freq = q.get("frequency", "medium")
        return f"From question bank — {freq} frequency"

    async def _get_job_questions(self, db, workspace_id, count, recent_ids) -> list[dict]:
        """Source B: prepared_questions from workspace."""
        ws = (
            db.table("job_workspace")
            .select("prepared_questions,company_name,role_title,competency_ranking")
            .eq("id", workspace_id)
            .maybe_single()
            .execute()
        )
        if not ws.data or not ws.data.get("prepared_questions"):
            return []

        prepared = ws.data["prepared_questions"]
        company = ws.data.get("company_name", "")
        role = ws.data.get("role_title", "")
        competencies = ws.data.get("competency_ranking", [])

        questions = []
        for i, pq in enumerate(prepared[:count]):
            q_text = pq if isinstance(pq, str) else pq.get("question", str(pq))
            comp = competencies[i] if i < len(competencies) else {}
            comp_name = comp.get("name", "") if isinstance(comp, dict) else str(comp)
            questions.append({
                "id": f"job_{workspace_id}_{i}",
                "question_text": q_text,
                "title": q_text[:80],
                "difficulty": "medium",
                "theme": comp_name,
                "_source": "job_specific",
                "_source_detail": f"Based on your {company} {role} JD — tests {comp_name}" if comp_name else f"Predicted for {company} {role}",
            })

        return questions

    async def _get_story_questions(self, db, user_id, count, recent_ids) -> list[dict]:
        """Source C: generated questions from storybank."""
        resp = (
            db.table("story_question")
            .select("*, story!inner(title, user_id)")
            .eq("story.user_id", user_id)
            .limit(count)
            .execute()
        )
        questions = []
        for sq in (resp.data or []):
            story_title = sq.get("story", {}).get("title", "your story")
            questions.append({
                "id": sq["id"],
                "question_text": sq["question_text"],
                "title": sq["question_text"][:80],
                "variations": sq.get("variations", []),
                "difficulty": "medium",
                "theme": sq.get("competency_tested", ""),
                "_source": "story_specific",
                "_source_detail": f"Tests your story: {story_title}",
            })
        return questions

    async def _get_gap_questions(self, db, user_id, count, recent_ids) -> list[dict]:
        """Source D: generated questions targeting resume/story gaps."""
        resp = (
            db.table("gap_question")
            .select("*")
            .eq("user_id", user_id)
            .limit(count)
            .execute()
        )
        questions = []
        for gq in (resp.data or []):
            questions.append({
                "id": gq["id"],
                "question_text": gq["question_text"],
                "title": gq["question_text"][:80],
                "variations": gq.get("variations", []),
                "difficulty": "medium",
                "theme": gq.get("gap_targeted", ""),
                "_source": "resume_gap",
                "_source_detail": f"Targets a gap — {gq.get('gap_targeted', 'identified weakness')}",
            })
        return questions

    async def get_shuffle_variation(
        self, question: dict, used_variations: list[str]
    ) -> Optional[str]:
        """Get an unused variation of a question for the Shuffle action."""
        variations = question.get("variations", [])
        unused = [v for v in variations if v not in used_variations]
        if unused:
            return random.choice(unused)
        return None

    async def get_random_question(
        self,
        user_id: str,
        workspace_id: Optional[str] = None,
    ) -> Optional[dict]:
        """Get a single context-aware question (for Atomic practice)."""
        questions = await self.get_questions(user_id, workspace_id=workspace_id, count=1)
        return questions[0] if questions else None

    async def record_history(
        self,
        user_id: str,
        question_id: str,
        workspace_id: Optional[str] = None,
        score_avg: Optional[float] = None,
        source: str = "bank",
    ) -> dict:
        """Record that a user practiced a question."""
        db = get_supabase()

        existing = (
            db.table("user_question_history")
            .select("id,times_practiced")
            .eq("user_id", user_id)
            .eq("question_id", question_id)
            .maybe_single()
            .execute()
        )

        if existing.data:
            update_data = {
                "times_practiced": existing.data["times_practiced"] + 1,
                "last_practiced": "now()",
                "source": source,
            }
            if score_avg is not None:
                update_data["score_avg"] = score_avg
            if workspace_id:
                update_data["workspace_id"] = workspace_id
            resp = (
                db.table("user_question_history")
                .update(update_data)
                .eq("id", existing.data["id"])
                .execute()
            )
            return resp.data[0]
        else:
            data = {
                "user_id": user_id,
                "question_id": question_id,
                "source": source,
            }
            if workspace_id:
                data["workspace_id"] = workspace_id
            if score_avg is not None:
                data["score_avg"] = score_avg
            resp = db.table("user_question_history").insert(data).execute()
            return resp.data[0]
```

**Step 2: Commit**

```bash
git add backend/api/services/question_service.py
git commit -m "feat: overhaul question selection with 4-source weighted algorithm

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4: Enhanced Scoring Engine

### Task 5: Extend Scoring Engine with Presence, Exemplar, and Micro-Drill

**Files:**
- Modify: `backend/api/services/scoring_engine.py`
- Create: `backend/api/prompts/practice_scoring.txt`

**Step 1: Create the practice scoring prompt module**

```text
## ENHANCED PRACTICE SCORING

In addition to the 5 core dimensions, also provide:

### COACHING BULLETS
Provide 3-5 specific, actionable coaching bullets. Each bullet should:
- Reference something specific from the candidate's answer (quote their words)
- Give a concrete action ("Instead of X, try Y")
- Be 1-2 sentences max

### EXEMPLAR ANSWER
Write a 170-260 word sample answer to the same question that demonstrates what a strong answer looks like. This should:
- Be written as a natural spoken response (not a script)
- Use the STAR format naturally (not labeled)
- Include specific metrics, names, and details (make them realistic for the candidate's level)
- Demonstrate the "earned secret" quality that scores 5.0 on Differentiation
- Be split into 2-3 natural paragraphs

### MICRO-DRILL
Create a focused 1-minute exercise targeting the weakest scoring dimension:
- Start with a 1-sentence intro explaining what skill this builds
- Give 2-3 numbered steps the candidate can do right now
- Keep it specific to this question and answer, not generic

### PRESENCE (Voice-Only)
If the answer is from a voice transcript (contains filler words, pauses, or spoken patterns):
- Score Presence 1.0-5.0:
  - 5.0: Confident pace, minimal fillers, natural pauses, strong vocal variety
  - 4.0: Good delivery with occasional fillers or rushing
  - 3.0: Noticeable fillers or pacing issues but still followable
  - 2.0: Frequent fillers, monotone, or rushing that hurts comprehension
  - 1.0: Delivery significantly undermines content quality
- If the answer appears to be typed text (clean, no fillers), set presence to null.
```

Write this to `backend/api/prompts/practice_scoring.txt`.

**Step 2: Update scoring engine**

```python
"""Scoring engine — evaluates answers on 5+1 dimensions with exemplar and drill."""

import json
from typing import Optional
from pydantic import BaseModel
from backend.api.services.ai_coach import AICoachService


class ScoreResult(BaseModel):
    substance: float
    structure: float
    relevance: float
    credibility: float
    differentiation: float
    presence: Optional[float] = None
    hire_signal: str
    feedback: str
    strongest_dimension: str
    weakest_dimension: str
    improvement_suggestion: str
    coaching_bullets: list[str] = []
    exemplar_answer: Optional[str] = None
    micro_drill: Optional[str] = None


class ScoringEngine:
    """Scores behavioral interview answers on 5+1 dimensions with coaching depth."""

    def __init__(self):
        self.coach = AICoachService()

    async def score_answer(
        self,
        question: str,
        answer: str,
        user_context: dict,
        self_scores: Optional[dict] = None,
        input_mode: str = "text",
    ) -> ScoreResult:
        """Score an answer with enhanced feedback including exemplar and drill."""
        message_parts = [
            f"## Question\n{question}",
            f"\n## Candidate's Answer\n{answer}",
            f"\n## Input Mode: {input_mode}",
        ]

        if self_scores:
            message_parts.append(
                f"\n## Candidate's Self-Assessment\n"
                f"Substance: {self_scores.get('substance', '?')}, "
                f"Structure: {self_scores.get('structure', '?')}, "
                f"Relevance: {self_scores.get('relevance', '?')}, "
                f"Credibility: {self_scores.get('credibility', '?')}, "
                f"Differentiation: {self_scores.get('differentiation', '?')}"
            )

        message_parts.append(
            "\n## Instructions\n"
            "Score this answer on all 5 core dimensions (1.0-5.0, use 0.5 increments). "
            "If input_mode is 'voice', also score presence (1.0-5.0). "
            "If input_mode is 'text', set presence to null.\n\n"
            "Return JSON with keys: substance, structure, relevance, credibility, "
            "differentiation, presence (float or null), "
            "hire_signal (strong_hire/hire/mixed/no_hire), "
            "feedback (2-3 sentences of direct coaching), "
            "strongest_dimension, weakest_dimension, "
            "improvement_suggestion (single most impactful change), "
            "coaching_bullets (array of 3-5 specific actionable strings), "
            "exemplar_answer (170-260 word sample answer string), "
            "micro_drill (1-minute exercise string targeting weakest dimension)."
        )

        raw = await self.coach.coach_json("practice_scoring", user_context, "\n".join(message_parts))
        data = json.loads(raw)

        return ScoreResult(
            substance=float(data.get("substance", 3.0)),
            structure=float(data.get("structure", 3.0)),
            relevance=float(data.get("relevance", 3.0)),
            credibility=float(data.get("credibility", 3.0)),
            differentiation=float(data.get("differentiation", 3.0)),
            presence=float(data["presence"]) if data.get("presence") is not None else None,
            hire_signal=data.get("hire_signal", "mixed"),
            feedback=data.get("feedback", ""),
            strongest_dimension=data.get("strongest_dimension", ""),
            weakest_dimension=data.get("weakest_dimension", ""),
            improvement_suggestion=data.get("improvement_suggestion", ""),
            coaching_bullets=data.get("coaching_bullets", []),
            exemplar_answer=data.get("exemplar_answer"),
            micro_drill=data.get("micro_drill"),
        )

    async def generate_session_debrief(
        self,
        scores: list[dict],
        questions: list[dict],
        user_context: dict,
        tier: str = "session",
        round_context: Optional[dict] = None,
    ) -> dict:
        """Generate pattern/theme debrief across multiple scored answers.

        tier='session' → pattern debrief (5 questions)
        tier='round_prep' → theme debrief with round context
        """
        score_summary = []
        for i, (s, q) in enumerate(zip(scores, questions)):
            score_summary.append(
                f"Q{i+1}: {q.get('question_text', '?')[:100]}\n"
                f"  Scores: Sub={s.get('substance')}, Str={s.get('structure')}, "
                f"Rel={s.get('relevance')}, Cred={s.get('credibility')}, "
                f"Diff={s.get('differentiation')}, Hire={s.get('hire_signal')}"
            )

        message = f"## Session Scores\n" + "\n".join(score_summary)

        if tier == "round_prep" and round_context:
            message += (
                f"\n\n## Round Context\n"
                f"Company: {round_context.get('company', '?')}\n"
                f"Role: {round_context.get('role', '?')}\n"
                f"Round type: {round_context.get('round_type', '?')}\n"
                f"Key competencies: {', '.join(round_context.get('competencies', []))}"
            )

        if tier == "session":
            message += (
                "\n\n## Instructions\n"
                "Analyze patterns across these 5 answers. Return JSON with:\n"
                "- pattern_summary (2-3 sentences identifying recurring strengths and weaknesses)\n"
                "- strongest_pattern (what they consistently do well)\n"
                "- weakest_pattern (what consistently needs work)\n"
                "- dimension_averages (object with avg for each dimension)\n"
                "- top_3_actions (array of 3 specific improvements)"
            )
        else:
            message += (
                "\n\n## Instructions\n"
                "Evaluate this candidate's readiness for this specific interview round. Return JSON with:\n"
                "- theme_summary (2-3 sentences evaluating readiness for this round)\n"
                "- competencies_demonstrated (array of competencies shown)\n"
                "- competencies_missing (array of competencies not demonstrated)\n"
                "- story_diversity (did they repeat stories? note)\n"
                "- gap_identification (what would the interviewer be uncertain about?)\n"
                "- readiness (ready/needs_work/not_ready)\n"
                "- top_3_actions (array of 3 specific improvements for this round)"
            )

        raw = await self.coach.coach_json("practice_scoring", user_context, message)
        return json.loads(raw)
```

**Step 3: Register `practice_scoring` command in prompt composer**

In `backend/api/services/prompt_composer.py`, add to `COMMAND_MODULES`:

```python
"practice_scoring": ["rubrics", "practice_scoring", "calibration", "transcript_processing"],
```

**Step 4: Commit**

```bash
git add backend/api/services/scoring_engine.py backend/api/prompts/practice_scoring.txt backend/api/services/prompt_composer.py
git commit -m "feat: enhance scoring engine with presence, exemplar answers, micro-drills, and session debriefs

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5: Practice Router Overhaul

### Task 6: Rebuild Practice Router with All Tiers

**Files:**
- Modify: `backend/api/routers/practice.py`

**Step 1: Rewrite the practice router**

```python
"""Practice session API — Atomic, Session, Round Prep tiers with try-again/shuffle."""

import json
from typing import Optional
from datetime import date, timezone, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.question_service import QuestionService, STAGE_CONFIG
from backend.api.services.scoring_engine import ScoringEngine
from backend.api.services.ai_coach import AICoachService
from backend.api.services.question_generator import QuestionGenerator

router = APIRouter(prefix="/api/practice", tags=["practice"])
question_service = QuestionService()
scoring_engine = ScoringEngine()
coach = AICoachService()
question_generator = QuestionGenerator()


# ─── Request Models ───

class QuickStartRequest(BaseModel):
    """Start a Quick Practice session (atomic, session, or round_prep)."""
    workspace_id: Optional[str] = None
    tier: str = "atomic"  # atomic | session | round_prep
    round_id: Optional[str] = None  # for round_prep
    theme: Optional[str] = None
    source_filter: Optional[str] = None  # bank | job_specific | story_specific | resume_gap
    question_count: Optional[int] = None  # None = tier default


class GuidedStartRequest(BaseModel):
    """Start a Guided Program session at a specific stage."""
    workspace_id: Optional[str] = None
    stage: int = 1
    question_count: int = 3


class SubmitAnswerRequest(BaseModel):
    question_id: str
    question_text: str  # needed for generated questions without DB id
    answer: str
    input_mode: str = "text"  # text | voice
    attempt_number: int = 1
    self_scores: Optional[dict] = None


class ShuffleRequest(BaseModel):
    question_id: str
    question_text: str
    used_variations: list[str] = []


# ─── Quick Practice ───

@router.post("/quick/start")
async def start_quick_practice(
    req: QuickStartRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Start a Quick Practice session — selects questions based on tier."""
    db = get_supabase()

    # Determine question count by tier
    if req.question_count:
        count = req.question_count
    elif req.tier == "atomic":
        count = 1
    elif req.tier == "session":
        count = 5
    else:  # round_prep
        count = 5

    # For round_prep, get round context
    round_context = None
    if req.tier == "round_prep" and req.round_id:
        round_resp = (
            db.table("interview_round")
            .select("*, job_workspace!inner(company_name,role_title,competency_ranking,prepared_questions)")
            .eq("id", req.round_id)
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        if round_resp.data:
            round_context = round_resp.data
            ws = round_resp.data.get("job_workspace", {})
            req.workspace_id = round_resp.data.get("workspace_id", req.workspace_id)
            count = min(6, max(4, len(ws.get("prepared_questions", [])[:6])))

    questions = await question_service.get_questions(
        user_id=user.id,
        workspace_id=req.workspace_id,
        theme=req.theme,
        count=count,
        source_filter=req.source_filter,
    )

    if not questions:
        raise HTTPException(404, "No questions available for this configuration")

    # Create session record
    session_data = {
        "user_id": user.id,
        "drill_type": "quick",
        "tier": req.tier,
        "question_ids": [q.get("id", q.get("question_text", "")[:50]) for q in questions],
    }
    if req.workspace_id:
        session_data["workspace_id"] = req.workspace_id
    if req.round_id:
        session_data["round_id"] = req.round_id

    session_resp = db.table("practice_session").insert(session_data).execute()
    session = session_resp.data[0]

    return {
        "session_id": session["id"],
        "questions": questions,
        "tier": req.tier,
        "round_context": round_context,
    }


# ─── Guided Program ───

@router.post("/guided/start")
async def start_guided_practice(
    req: GuidedStartRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Start a Guided Program session at a specific drill stage."""
    db = get_supabase()

    if req.stage not in STAGE_CONFIG:
        raise HTTPException(400, f"Invalid stage: {req.stage}. Must be 1-8.")

    stage_info = STAGE_CONFIG[req.stage]

    # Check progression
    progression = (
        db.table("drill_progression")
        .select("*")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    current_stage = progression.data["current_stage"] if progression.data else 1
    skipped = False

    if req.stage > current_stage:
        skipped = True
        # Allow but record the skip

    questions = await question_service.get_questions(
        user_id=user.id,
        workspace_id=req.workspace_id,
        difficulty=stage_info.get("difficulty"),
        count=req.question_count,
        stage=req.stage,
    )

    if not questions:
        raise HTTPException(404, "No questions available for this stage")

    session_data = {
        "user_id": user.id,
        "drill_type": stage_info["name"].lower(),
        "stage": req.stage,
        "tier": "guided",
        "question_ids": [q.get("id", "") for q in questions],
    }
    if req.workspace_id:
        session_data["workspace_id"] = req.workspace_id

    session_resp = db.table("practice_session").insert(session_data).execute()
    session = session_resp.data[0]

    return {
        "session_id": session["id"],
        "questions": questions,
        "stage": req.stage,
        "stage_info": {
            "name": stage_info["name"],
            "gate_dim": stage_info.get("gate_dim", ""),
            "gate_score": stage_info.get("gate_score", 3.0),
            "time_limit": stage_info.get("time_limit"),
            "include_followups": stage_info.get("include_followups", False),
        },
        "skipped": skipped,
        "current_unlocked_stage": current_stage,
    }


@router.get("/guided/progression")
async def get_progression(
    user: AuthUser = Depends(get_current_user),
):
    """Get the user's drill progression status."""
    db = get_supabase()
    progression = (
        db.table("drill_progression")
        .select("*")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )

    if not progression.data:
        return {
            "current_stage": 1,
            "gates_passed": [],
            "stages": STAGE_CONFIG,
        }

    return {
        "current_stage": progression.data.get("current_stage", 1),
        "gates_passed": progression.data.get("gates_passed", []),
        "stages": STAGE_CONFIG,
    }


# ─── Submit Answer ───

@router.post("/{session_id}/submit")
async def submit_answer(
    session_id: str,
    req: SubmitAnswerRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Submit an answer for scoring — works for both Quick and Guided."""
    db = get_supabase()

    # Verify session
    session_resp = (
        db.table("practice_session")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(404, "Practice session not found")

    session = session_resp.data

    # Build user context and score
    user_context = await coach.build_user_context(user.id, session.get("workspace_id"))
    score_result = await scoring_engine.score_answer(
        question=req.question_text,
        answer=req.answer,
        user_context=user_context,
        self_scores=req.self_scores,
        input_mode=req.input_mode,
    )

    # Calculate average
    score_avg = round(
        (
            score_result.substance
            + score_result.structure
            + score_result.relevance
            + score_result.credibility
            + score_result.differentiation
        ) / 5, 1,
    )

    # Save score entry
    score_data = {
        "user_id": user.id,
        "entry_type": "practice",
        "context": req.question_text[:200],
        "substance": score_result.substance,
        "structure": score_result.structure,
        "relevance": score_result.relevance,
        "credibility": score_result.credibility,
        "differentiation": score_result.differentiation,
        "presence": score_result.presence,
        "hire_signal": score_result.hire_signal,
        "attempt_number": req.attempt_number,
        "input_mode": req.input_mode,
        "question_id": req.question_id,
        "raw_feedback": {
            "feedback": score_result.feedback,
            "strongest": score_result.strongest_dimension,
            "weakest": score_result.weakest_dimension,
            "suggestion": score_result.improvement_suggestion,
            "coaching_bullets": score_result.coaching_bullets,
            "exemplar_answer": score_result.exemplar_answer,
            "micro_drill": score_result.micro_drill,
        },
    }
    if session.get("workspace_id"):
        score_data["workspace_id"] = session["workspace_id"]

    db.table("score_entry").insert(score_data).execute()

    # Record question history
    await question_service.record_history(
        user_id=user.id,
        question_id=req.question_id,
        workspace_id=session.get("workspace_id"),
        score_avg=score_avg,
        source="practice",
    )

    # Update daily practice tracking
    await _update_daily_practice(db, user.id)

    # Check stage gate advancement (for guided sessions)
    gate_result = None
    if session.get("stage"):
        gate_result = await _check_stage_gate(db, user.id, session["stage"])

    return {
        "scores": score_result.model_dump(),
        "average": score_avg,
        "gate_result": gate_result,
    }


# ─── Shuffle ───

@router.post("/{session_id}/shuffle")
async def shuffle_question(
    session_id: str,
    req: ShuffleRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Get a variation of the current question (same competency, different phrasing)."""
    db = get_supabase()

    # Verify session
    session_resp = (
        db.table("practice_session")
        .select("id")
        .eq("id", session_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(404, "Practice session not found")

    # Try stored variations first
    variation = await question_service.get_shuffle_variation(
        {"id": req.question_id, "question_text": req.question_text, "variations": []},
        req.used_variations,
    )

    # Check the question table for variations
    if not variation:
        q_resp = (
            db.table("question")
            .select("variations")
            .eq("id", req.question_id)
            .maybe_single()
            .execute()
        )
        if q_resp.data and q_resp.data.get("variations"):
            stored = q_resp.data["variations"]
            unused = [v for v in stored if v not in req.used_variations]
            if unused:
                import random
                variation = random.choice(unused)

    # Check story_question variations
    if not variation:
        sq_resp = (
            db.table("story_question")
            .select("variations")
            .eq("id", req.question_id)
            .maybe_single()
            .execute()
        )
        if sq_resp.data and sq_resp.data.get("variations"):
            stored = sq_resp.data["variations"]
            unused = [v for v in stored if v not in req.used_variations]
            if unused:
                import random
                variation = random.choice(unused)

    # Fallback: generate on-the-fly
    if not variation:
        user_context = await coach.build_user_context(user.id)
        variations = await question_generator.generate_variations(
            req.question_text, user_context, count=1
        )
        variation = variations[0] if variations else None

    if not variation:
        raise HTTPException(404, "No more variations available")

    return {"variation": variation}


# ─── Session Debrief ───

@router.post("/{session_id}/debrief")
async def get_session_debrief(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Generate a pattern/theme debrief for a completed session."""
    db = get_supabase()

    session_resp = (
        db.table("practice_session")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(404, "Practice session not found")

    session = session_resp.data

    # Get all scores for this session
    scores_resp = (
        db.table("score_entry")
        .select("*")
        .eq("user_id", user.id)
        .eq("entry_type", "practice")
        .order("created_at", desc=False)
        .execute()
    )

    # Filter to scores that match this session's questions
    question_ids = set(session.get("question_ids", []))
    session_scores = [
        s for s in (scores_resp.data or [])
        if s.get("question_id") in question_ids
    ]

    if len(session_scores) < 2:
        raise HTTPException(400, "Need at least 2 scored answers for a debrief")

    # Build question list for context
    questions = [{"question_text": s.get("context", "")} for s in session_scores]

    # Get round context for round_prep
    round_context = None
    if session.get("tier") == "round_prep" and session.get("round_id"):
        round_resp = (
            db.table("interview_round")
            .select("*, job_workspace!inner(company_name,role_title,competency_ranking)")
            .eq("id", session["round_id"])
            .maybe_single()
            .execute()
        )
        if round_resp.data:
            ws = round_resp.data.get("job_workspace", {})
            round_context = {
                "company": ws.get("company_name", ""),
                "role": ws.get("role_title", ""),
                "round_type": round_resp.data.get("round_type", ""),
                "competencies": [c.get("name", str(c)) for c in (ws.get("competency_ranking") or [])[:5]],
            }

    user_context = await coach.build_user_context(user.id, session.get("workspace_id"))
    tier = session.get("tier", "session")

    debrief = await scoring_engine.generate_session_debrief(
        scores=session_scores,
        questions=questions,
        user_context=user_context,
        tier=tier,
        round_context=round_context,
    )

    return debrief


# ─── Daily Practice & Streaks ───

@router.get("/daily")
async def get_daily_practice(
    user: AuthUser = Depends(get_current_user),
):
    """Get daily practice stats and current streak."""
    db = get_supabase()
    today = date.today().isoformat()

    today_resp = (
        db.table("daily_practice")
        .select("*")
        .eq("user_id", user.id)
        .eq("practice_date", today)
        .maybe_single()
        .execute()
    )

    # Get streak from most recent entry
    recent_resp = (
        db.table("daily_practice")
        .select("streak_count,practice_date")
        .eq("user_id", user.id)
        .order("practice_date", desc=True)
        .limit(1)
        .execute()
    )

    streak = 0
    if recent_resp.data:
        streak = recent_resp.data[0].get("streak_count", 0)

    return {
        "today": today_resp.data if today_resp.data else {"questions_answered": 0},
        "streak": streak,
        "practiced_today": bool(today_resp.data),
    }


@router.get("/history")
async def get_practice_history(
    user: AuthUser = Depends(get_current_user),
    workspace_id: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """Get past practice sessions with optional filters."""
    db = get_supabase()
    query = (
        db.table("practice_session")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if workspace_id:
        query = query.eq("workspace_id", workspace_id)
    if tier:
        query = query.eq("tier", tier)

    resp = query.execute()
    return {"sessions": resp.data or [], "count": len(resp.data or [])}


# ─── Helpers ───

async def _update_daily_practice(db, user_id: str):
    """Increment daily practice count and update streak."""
    today = date.today().isoformat()
    yesterday = (date.today().replace(day=date.today().day - 1)).isoformat() if date.today().day > 1 else date.today().isoformat()

    existing = (
        db.table("daily_practice")
        .select("*")
        .eq("user_id", user_id)
        .eq("practice_date", today)
        .maybe_single()
        .execute()
    )

    if existing.data:
        db.table("daily_practice").update({
            "questions_answered": existing.data["questions_answered"] + 1,
            "updated_at": "now()",
        }).eq("user_id", user_id).eq("practice_date", today).execute()
    else:
        # Calculate streak
        yesterday_resp = (
            db.table("daily_practice")
            .select("streak_count")
            .eq("user_id", user_id)
            .order("practice_date", desc=True)
            .limit(1)
            .execute()
        )
        prev_streak = 0
        if yesterday_resp.data:
            prev_date = yesterday_resp.data[0].get("practice_date")
            if prev_date and str(prev_date) >= yesterday:
                prev_streak = yesterday_resp.data[0].get("streak_count", 0)

        db.table("daily_practice").insert({
            "user_id": user_id,
            "practice_date": today,
            "questions_answered": 1,
            "streak_count": prev_streak + 1,
        }).execute()


async def _check_stage_gate(db, user_id: str, stage: int) -> Optional[dict]:
    """Check if user has met the gating criteria for a stage."""
    if stage not in STAGE_CONFIG:
        return None

    config = STAGE_CONFIG[stage]
    gate_dim = config.get("gate_dim", "")
    gate_score = config.get("gate_score", 3.0)

    # Get last 3 practice scores
    recent = (
        db.table("score_entry")
        .select("substance,structure,relevance,credibility,differentiation")
        .eq("user_id", user_id)
        .eq("entry_type", "practice")
        .order("created_at", desc=True)
        .limit(3)
        .execute()
    )

    if not recent.data or len(recent.data) < 3:
        return {"passed": False, "reason": "Need at least 3 scored rounds"}

    scores = recent.data

    if gate_dim == "all":
        dims = ["substance", "structure", "relevance", "credibility", "differentiation"]
        passed = all(
            all(s.get(d, 0) >= gate_score for d in dims)
            for s in scores
        )
    elif "," in gate_dim:
        dims = [d.strip() for d in gate_dim.split(",")]
        passed = all(
            all(s.get(d, 0) >= gate_score for d in dims)
            for s in scores
        )
    else:
        passed = all(s.get(gate_dim, 0) >= gate_score for s in scores)

    if passed:
        # Advance progression
        progression = (
            db.table("drill_progression")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if progression.data:
            gates = progression.data.get("gates_passed", [])
            stage_name = config["name"]
            if stage_name not in gates:
                gates.append(stage_name)
            db.table("drill_progression").update({
                "current_stage": stage + 1,
                "gates_passed": gates,
                "updated_at": "now()",
            }).eq("user_id", user_id).execute()
        else:
            db.table("drill_progression").insert({
                "user_id": user_id,
                "current_stage": stage + 1,
                "gates_passed": [config["name"]],
            }).execute()

    return {
        "passed": passed,
        "stage": stage,
        "gate_dim": gate_dim,
        "gate_score": gate_score,
        "next_stage": stage + 1 if passed else stage,
    }
```

**Step 2: Commit**

```bash
git add backend/api/routers/practice.py
git commit -m "feat: rebuild practice router with quick/guided modes, shuffle, debrief, daily tracking

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6: Frontend — Practice Page Rebuild

### Task 7: Practice Hook

**Files:**
- Modify: `frontend/src/hooks/usePractice.ts`

Replace with a hook that supports Quick Practice (atomic/session/round prep) and Guided Program, with try-again/shuffle/next actions, attempt tracking, and session debrief.

The hook should:
- Use React Query for fetching progression and daily stats
- Use mutations for starting sessions, submitting answers, shuffling
- Track attempt history per question (attempt 1: 2.8 → attempt 2: 3.4)
- Support both voice and text input modes
- Manage the full lifecycle: start → question → answer → score → try again/shuffle/next → debrief

Key interfaces to export:

```typescript
export type PracticeTier = 'atomic' | 'session' | 'round_prep';
export type PracticeMode = 'quick' | 'guided';
export type InputMode = 'voice' | 'text';
export type QuestionSource = 'bank' | 'job_specific' | 'story_specific' | 'resume_gap';

export interface PracticeQuestion {
  id: string;
  questionText: string;
  title: string;
  source: QuestionSource;
  sourceDetail: string;
  theme: string;
  variations: string[];
  difficulty: string;
}

export interface AttemptScore {
  attemptNumber: number;
  average: number;
  scores: ScoreResult;
}

export interface ScoreResult {
  substance: number;
  structure: number;
  relevance: number;
  credibility: number;
  differentiation: number;
  presence: number | null;
  hireSignal: string;
  feedback: string;
  strongestDimension: string;
  weakestDimension: string;
  improvementSuggestion: string;
  coachingBullets: string[];
  exemplarAnswer: string | null;
  microDrill: string | null;
}

export interface StageInfo {
  name: string;
  gateDim: string;
  gateScore: number;
  timeLimit: number | null;
  includeFollowups: boolean;
}
```

The hook returns: `mode, tier, sessionId, questions, currentQuestion, currentQuestionIndex, attempts, latestScore, isScoring, stageInfo, progression, dailyStats, startQuick, startGuided, submitAnswer, tryAgain, shuffle, nextQuestion, endSession, requestDebrief, debrief, setInputMode, inputMode`

**Step 1: Write the full hook implementation**

This is a large file. Implement it following the existing hook patterns (useState, useCallback, React Query mutations). Reference `useStoryChat.ts` for the API call pattern with axios.

**Step 2: Commit**

```bash
git add frontend/src/hooks/usePractice.ts
git commit -m "feat: rebuild usePractice hook with 4-source questions, tiers, shuffle, and scoring

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Enhanced Scorecard Component

**Files:**
- Modify: `frontend/src/components/Scorecard.tsx`

Rebuild with progressive disclosure: condensed view (default) → expanded view → depth tabs.

The new Scorecard should support:
- **Condensed mode** (default): single average score + one coaching tip + hire signal
- **Expanded mode** (click "See full breakdown"): 5 dimension bars + coaching bullets
- **Tabs**: Coaching Notes | Exemplar Answer | Quick Drill
- **Presence bar**: shown only when `presence` is not null
- **Attempt history**: "Attempt 1: 2.8 → Attempt 2: 3.4 → Attempt 3: 3.9"

```typescript
interface ScorecardProps {
  scores: {
    substance: number;
    structure: number;
    relevance: number;
    credibility: number;
    differentiation: number;
    presence?: number | null;
  };
  hireSignal: string;
  feedback: string;
  coachingBullets?: string[];
  exemplarAnswer?: string | null;
  microDrill?: string | null;
  attempts?: { attemptNumber: number; average: number }[];
}
```

**Step 1: Write the enhanced Scorecard**

Follow existing CSS class patterns (`.scorecard`, `.score-dims`, `.score-dim`, `.tag`). Add new classes for the condensed/expanded toggle and tabs.

**Step 2: Add CSS for new scorecard features**

Add to `frontend/src/pages/pages.css`:
- `.scorecard-condensed` — single score display
- `.scorecard-expand-btn` — "See full breakdown" link
- `.scorecard-tabs` — tab navigation
- `.scorecard-tab-panel` — tab content
- `.scorecard-attempts` — attempt history display

**Step 3: Commit**

```bash
git add frontend/src/components/Scorecard.tsx frontend/src/pages/pages.css
git commit -m "feat: enhance Scorecard with condensed/expanded views, tabs, attempt tracking

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Source Indicator Component

**Files:**
- Create: `frontend/src/components/SourceIndicator.tsx`

Small component showing a colored dot with tooltip explanation on click.

```typescript
interface SourceIndicatorProps {
  source: 'bank' | 'job_specific' | 'story_specific' | 'resume_gap';
  detail: string;
}
```

Colors:
- `bank` → blue (`var(--c-structure)`)
- `job_specific` → green
- `story_specific` → purple
- `resume_gap` → orange

Default: dot only. Click toggles detail text visibility.

**Step 1: Write the component and CSS**

**Step 2: Commit**

```bash
git add frontend/src/components/SourceIndicator.tsx
git commit -m "feat: add SourceIndicator component with colored dots and detail tooltip

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Rebuild Practice Page

**Files:**
- Modify: `frontend/src/pages/Practice.tsx`

Complete rebuild with two modes:
1. **Quick Practice** — mode selector (Atomic/Session/Round Prep), question display with source indicator, voice/text input toggle, answer submission, scorecard, try again/shuffle/next buttons
2. **Guided Program** — stage stepper with mastered badges, stage selection with gate warnings, warmup display, same core loop

The page structure:

```
Practice
├── Mode Selector (Quick Practice | Guided Program)
├── [Quick Practice Mode]
│   ├── Tier Selector (Atomic | Session | Round Prep)
│   ├── Filters (theme, source)
│   ├── Daily Stats bar (streak, questions today)
│   ├── Question Card
│   │   ├── Source Indicator
│   │   ├── Question Text
│   │   ├── Input Mode Toggle (Voice | Text)
│   │   ├── VoiceRecorder or TextArea
│   │   └── Submit Button
│   ├── Scorecard (after submission)
│   ├── Action Buttons (Try Again | Shuffle | Next Question)
│   └── Session Debrief (after session/round_prep complete)
├── [Guided Program Mode]
│   ├── Stage Stepper (8 stages with mastered badges)
│   ├── Stage Info Card (gate requirements, time limit)
│   ├── Question Card (same as Quick Practice)
│   ├── Scorecard
│   ├── Gate Result (passed/not passed)
│   └── Action Buttons
```

**Step 1: Write the full Practice page**

Follow existing page patterns from `Storybank.tsx` and current `Practice.tsx`. Use `.page-header`, `.card`, `.card-header`, `.card-body`, `.btn` classes.

**Step 2: Commit**

```bash
git add frontend/src/pages/Practice.tsx
git commit -m "feat: rebuild Practice page with Quick Practice and Guided Program modes

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 7: Mock Interview Backend

### Task 11: Mock Interview Router

**Files:**
- Create: `backend/api/routers/mock.py`
- Modify: `backend/main.py` — register the new router

Create dedicated mock interview endpoints that use the same question selection and scoring engine but defer all feedback to the debrief.

Endpoints:
- `POST /api/mock/start` — start a mock session with format selection, returns questions
- `POST /api/mock/{session_id}/submit` — submit an answer (scores silently, no feedback returned)
- `POST /api/mock/{session_id}/debrief` — generate full debrief (all per-Q scores + arc analysis + hire signal + interviewer monologue)
- `GET /api/mock/history` — past mock sessions

The debrief prompt should request: per-question scores, arc_analysis, story_diversity, holistic_patterns, interviewer_monologue, hire_signal, top_3_changes.

**Step 1: Write the mock router**

**Step 2: Create `backend/api/prompts/mock_debrief.txt`** with the full debrief prompt

**Step 3: Register in prompt_composer.py and main.py**

**Step 4: Commit**

```bash
git add backend/api/routers/mock.py backend/api/prompts/mock_debrief.txt backend/api/services/prompt_composer.py backend/main.py
git commit -m "feat: add mock interview router with silent scoring and full debrief

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 8: Mock Interview Frontend

### Task 12: Mock Interview Hook and Page Rebuild

**Files:**
- Modify: `frontend/src/hooks/useMock.ts`
- Modify: `frontend/src/pages/MockInterview.tsx`

Wire mock interview to the real backend:
- `startSession` calls `POST /api/mock/start` with format
- Questions come from the API (not hardcoded)
- `submitAnswer` sends to `POST /api/mock/{session_id}/submit` silently
- `finishInterview` calls `POST /api/mock/{session_id}/debrief`
- Debrief page shows full results

**Step 1: Rewrite useMock hook with API integration**

**Step 2: Rebuild MockInterview page with debrief view**

After the last question, show a "Generate Debrief" button. When clicked, display:
- Per-question scores (all revealed at once)
- Arc analysis
- Hire signal
- Interviewer's inner monologue
- Top 3 changes

**Step 3: Commit**

```bash
git add frontend/src/hooks/useMock.ts frontend/src/pages/MockInterview.tsx
git commit -m "feat: wire mock interview to backend with real questions and full debrief

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 9: Integration

### Task 13: Workspace Round Prep Shortcut

**Files:**
- Modify: `frontend/src/pages/InterviewPrep.tsx` (or wherever workspace round details are shown)

Add a "Practice this round" button next to each interview round that navigates to Practice with `tier=round_prep` and the round_id pre-selected.

**Step 1: Add the button with navigation**

```typescript
<button
  className="btn btn-outline btn-sm"
  onClick={() => navigate(`/practice?tier=round_prep&round_id=${round.id}`)}
>
  Practice this round
</button>
```

**Step 2: Update Practice page to read URL params on mount**

In the Practice page, check for `?tier=round_prep&round_id=xxx` query params and auto-start a round prep session.

**Step 3: Commit**

```bash
git add frontend/src/pages/InterviewPrep.tsx frontend/src/pages/Practice.tsx
git commit -m "feat: add 'Practice this round' shortcut from workspace to Practice tab

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Text Input Mode for Practice

**Files:**
- Create: `frontend/src/components/TextAnswer.tsx`
- Modify: `frontend/src/pages/Practice.tsx` — integrate text input alongside VoiceRecorder

Simple textarea component for text-based answers:

```typescript
interface TextAnswerProps {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}
```

The Practice page shows an input mode toggle (Voice | Text). Voice shows VoiceRecorder, Text shows TextAnswer.

**Step 1: Write TextAnswer component**

**Step 2: Integrate into Practice page with toggle**

**Step 3: Commit**

```bash
git add frontend/src/components/TextAnswer.tsx frontend/src/pages/Practice.tsx
git commit -m "feat: add text input mode as alternative to voice recording in practice

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Execution Order

Tasks are ordered by dependency:

1. **Task 1** — Migration (foundation for everything)
2. **Task 2** — Question generator service (needs new tables)
3. **Task 3** — Hook generation into story/resume flows (needs generator)
4. **Task 4** — Question selection algorithm (needs new tables)
5. **Task 5** — Enhanced scoring engine (needs new columns)
6. **Task 6** — Practice router (needs tasks 2-5)
7. **Task 7** — Practice hook (needs task 6 API)
8. **Task 8** — Enhanced Scorecard (needs new score fields)
9. **Task 9** — Source indicator component (standalone)
10. **Task 10** — Practice page rebuild (needs tasks 7-9)
11. **Task 11** — Mock interview router (needs task 5 scoring)
12. **Task 12** — Mock interview frontend (needs task 11)
13. **Task 13** — Workspace shortcut (needs task 10)
14. **Task 14** — Text input mode (needs task 10)

Tasks 7-9 can run in parallel. Tasks 13-14 can run in parallel.
