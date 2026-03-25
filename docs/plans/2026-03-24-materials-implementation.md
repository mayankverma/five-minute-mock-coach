# Materials Section Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Resume, LinkedIn, Pitch, and Outreach pages as standalone routes under the BUILD sidebar group, with resume upload + parsing + analysis as the gateway feature.

**Architecture:** New `resume` DB table replaces the flat `resume_analysis` table. Resume uploads are parsed into structured `resume_section` rows for the builder UI. A new `/api/resume` router handles upload, section CRUD, and SSE coach chat. Frontend gets 4 new page components with a split-pane layout (builder/results left, analysis/coach right). Existing materials endpoints for pitch/linkedin remain mostly unchanged.

**Tech Stack:** React 19, TypeScript, Vite, react-router-dom v7, TanStack React Query, FastAPI, OpenAI (gpt-4o), Supabase (Postgres + Storage), SSE streaming.

**Design Doc:** `docs/plans/2026-03-24-materials-section-design.md`

---

## Phase 1: Database Migration

### Task 1: Create migration 005 for resume tables

**Files:**
- Create: `backend/db/migrations/005_resume_tables.sql`

**Step 1: Write the migration**

```sql
-- ============================================================
-- RESUME BUILDER TABLES
-- ============================================================

-- Core resume entity
CREATE TABLE resume (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES job(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Master Resume',
    original_file_name TEXT,
    raw_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One master resume per user (general prep)
CREATE UNIQUE INDEX resume_master_unique ON resume (user_id) WHERE job_id IS NULL;
-- One resume per job workspace
CREATE UNIQUE INDEX resume_job_unique ON resume (job_id) WHERE job_id IS NOT NULL;

-- Parsed resume sections (the builder data)
CREATE TABLE resume_section (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resume(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    content JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX resume_section_resume_idx ON resume_section (resume_id);

-- Updated resume analysis (now references resume, not user directly)
-- We keep the old resume_analysis table for backward compat and add a new one
CREATE TABLE resume_analysis_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resume(id) ON DELETE CASCADE,
    depth_level TEXT NOT NULL DEFAULT 'standard',
    overall_grade TEXT,
    ats_compatibility TEXT,
    recruiter_scan TEXT,
    bullet_quality TEXT,
    seniority_calibration TEXT,
    keyword_coverage TEXT,
    structure_layout TEXT,
    consistency_polish TEXT,
    concern_management TEXT,
    top_fixes JSONB DEFAULT '[]',
    concern_mitigations JSONB DEFAULT '[]',
    positioning_strengths TEXT,
    likely_concerns TEXT,
    career_narrative_gaps TEXT,
    story_seeds JSONB DEFAULT '[]',
    cross_surface_gaps JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX resume_analysis_v2_resume_idx ON resume_analysis_v2 (resume_id);

-- Resume coach chat sessions
CREATE TABLE resume_coach_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resume(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE resume_coach_message (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES resume_coach_session(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    suggested_edits JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX resume_coach_message_session_idx ON resume_coach_message (session_id);

-- RLS policies
ALTER TABLE resume ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their resumes" ON resume FOR ALL USING (auth.uid() = user_id);

ALTER TABLE resume_section ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their resume sections" ON resume_section FOR ALL
    USING (resume_id IN (SELECT id FROM resume WHERE user_id = auth.uid()));

ALTER TABLE resume_analysis_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their resume analysis" ON resume_analysis_v2 FOR ALL
    USING (resume_id IN (SELECT id FROM resume WHERE user_id = auth.uid()));

ALTER TABLE resume_coach_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their coach sessions" ON resume_coach_session FOR ALL
    USING (resume_id IN (SELECT id FROM resume WHERE user_id = auth.uid()));

ALTER TABLE resume_coach_message ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their coach messages" ON resume_coach_message FOR ALL
    USING (session_id IN (
        SELECT rcs.id FROM resume_coach_session rcs
        JOIN resume r ON rcs.resume_id = r.id
        WHERE r.user_id = auth.uid()
    ));
```

**Step 2: Apply the migration**

Run: `cd /Users/mayankverma/Desktop/MayankApps/five-minute-mock-coach && cat backend/db/migrations/005_resume_tables.sql`
Verify the SQL looks correct, then apply via Supabase MCP tool `apply_migration`.

**Step 3: Commit**

```bash
git add backend/db/migrations/005_resume_tables.sql
git commit -m "feat: add resume builder tables (resume, resume_section, resume_analysis_v2, coach session)"
```

---

## Phase 2: Navigation & Routing Restructure

### Task 2: Add new routes to App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Add imports for new page components**

Add after line 16 (`import { Materials }...`):
```typescript
import { ResumePage } from './pages/ResumePage';
import { LinkedInPage } from './pages/LinkedInPage';
import { PitchPage } from './pages/PitchPage';
import { OutreachPage } from './pages/OutreachPage';
```

**Step 2: Add new routes inside the AppLayout Route group**

Add after the `/materials` route (line 48):
```typescript
<Route path="/resume" element={<ResumePage />} />
<Route path="/linkedin" element={<LinkedInPage />} />
<Route path="/pitch" element={<PitchPage />} />
<Route path="/outreach" element={<OutreachPage />} />
```

Keep the `/materials` route for now (backward compat) — we'll remove it later.

**Step 3: Create stub page components**

Create minimal stub files so the app compiles. These will be fleshed out in later tasks.

Create `frontend/src/pages/ResumePage.tsx`:
```typescript
export function ResumePage() {
  return <div>Resume page — coming soon</div>;
}
```

Create `frontend/src/pages/LinkedInPage.tsx`:
```typescript
export function LinkedInPage() {
  return <div>LinkedIn page — coming soon</div>;
}
```

Create `frontend/src/pages/PitchPage.tsx`:
```typescript
export function PitchPage() {
  return <div>Pitch page — coming soon</div>;
}
```

Create `frontend/src/pages/OutreachPage.tsx`:
```typescript
export function OutreachPage() {
  return <div>Outreach page — coming soon</div>;
}
```

**Step 4: Verify app compiles**

Run: `cd frontend && npm run build`
Expected: Clean build with no errors.

**Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/ResumePage.tsx frontend/src/pages/LinkedInPage.tsx frontend/src/pages/PitchPage.tsx frontend/src/pages/OutreachPage.tsx
git commit -m "feat: add routes and stub pages for /resume, /linkedin, /pitch, /outreach"
```

### Task 3: Update Sidebar navigation

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx:13-28`

**Step 1: Update GENERAL_NAV**

Replace the `GENERAL_NAV` array (line 13) with:
```typescript
const GENERAL_NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Coaching', items: [{ to: '/', label: 'Dashboard' }] },
  {
    group: 'Build',
    items: [
      { to: '/resume', label: 'Resume' },
      { to: '/stories', label: 'Storybank', badge: 'Next' },
      { to: '/linkedin', label: 'LinkedIn' },
      { to: '/pitch', label: 'Pitch' },
      { to: '/outreach', label: 'Outreach' },
    ],
  },
  { group: 'Practice', items: [{ to: '/practice', label: 'Practice' }, { to: '/mock', label: 'Mock Interview' }] },
  { group: 'Track', items: [{ to: '/progress', label: 'Progress' }] },
];
```

**Step 2: Update JOB_NAV**

Replace `JOB_NAV` (line 21) with:
```typescript
const JOB_NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Coaching', items: [{ to: '/', label: 'Dashboard' }] },
  {
    group: 'Build',
    items: [
      { to: '/resume', label: 'Resume' },
      { to: '/stories', label: 'Storybank' },
    ],
  },
  { group: 'Prepare', items: [{ to: '/prep', label: 'Interview Prep' }] },
  { group: 'Practice', items: [{ to: '/practice', label: 'Practice' }, { to: '/mock', label: 'Mock Interview' }, { to: '/hype', label: 'Hype' }] },
  { group: 'Track', items: [{ to: '/debrief', label: 'Debrief' }, { to: '/progress', label: 'Progress' }] },
];
```

**Step 3: Verify**

Run: `cd frontend && npm run build`
Expected: Clean build, sidebar shows new BUILD group.

**Step 4: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: restructure sidebar — BUILD group with Resume, Storybank, LinkedIn, Pitch, Outreach"
```

### Task 4: Update Dashboard nudge link

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx:381`

**Step 1: Change the nudge button link**

At line 381, change:
```typescript
<button className="btn btn-primary btn-sm" onClick={() => window.location.href = '/materials'}>Upload Resume</button>
```
to:
```typescript
<button className="btn btn-primary btn-sm" onClick={() => window.location.href = '/resume'}>Upload Resume</button>
```

**Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "fix: update dashboard resume nudge to link to /resume"
```

---

## Phase 3: Resume Backend — Upload, Parse, Analyze

### Task 5: Create resume parser service

This service extracts structured sections from raw resume text.

**Files:**
- Create: `backend/api/services/resume_parser.py`

**Step 1: Write the parser service**

```python
"""Resume parser — extracts structured sections from raw resume text via AI."""

import json
from backend.api.services.ai_coach import AICoachService


class ResumeParser:
    """Parses raw resume text into structured sections using AI."""

    def __init__(self):
        self.coach = AICoachService()

    async def parse_sections(self, resume_text: str, user_context: dict) -> list[dict]:
        """Parse resume text into structured sections.

        Returns a list of section dicts with keys: section_type, sort_order, content.
        """
        message = (
            f"## Resume Content\n{resume_text[:6000]}\n\n"
            f"## Instructions\n"
            f"Parse this resume into structured sections. Return JSON with a "
            f"'sections' array where each section has:\n"
            f"- section_type: one of 'summary', 'experience', 'education', 'skills', 'certifications'\n"
            f"- sort_order: integer starting from 0\n"
            f"- content: structured object based on type:\n"
            f"  - summary: {{ \"text\": \"...\" }}\n"
            f"  - experience: {{ \"company\": \"...\", \"title\": \"...\", "
            f"\"start_date\": \"...\", \"end_date\": \"...\" or null, "
            f"\"location\": \"...\", \"bullets\": [\"...\"] }}\n"
            f"  - education: {{ \"institution\": \"...\", \"degree\": \"...\", "
            f"\"field\": \"...\", \"graduation_date\": \"...\", \"gpa\": null }}\n"
            f"  - skills: {{ \"categories\": [{{ \"name\": \"...\", \"skills\": [\"...\"] }}] }}\n"
            f"  - certifications: {{ \"items\": [{{ \"name\": \"...\", "
            f"\"issuer\": \"...\", \"date\": \"...\" }}] }}\n\n"
            f"Create one section per experience entry (each job is its own section). "
            f"If a section type is not present in the resume, omit it. "
            f"Preserve the original text as closely as possible — do not rewrite bullets."
        )
        raw = await self.coach.coach_json("resume", user_context, message)
        parsed = json.loads(raw)
        return parsed.get("sections", [])
```

**Step 2: Commit**

```bash
git add backend/api/services/resume_parser.py
git commit -m "feat: add ResumeParser service for extracting structured sections from resume text"
```

### Task 6: Create new resume router

**Files:**
- Create: `backend/api/routers/resume.py`
- Modify: `backend/main.py:9,29` (add import and registration)

**Step 1: Write the resume router**

```python
"""Resume API — upload, parse, analyze, section CRUD, coach chat."""

import json as json_mod
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.ai_coach import AICoachService
from backend.api.services.resume_service import ResumeService
from backend.api.services.resume_parser import ResumeParser

router = APIRouter(prefix="/api/resume", tags=["resume"])
coach = AICoachService()
resume_service = ResumeService()
resume_parser = ResumeParser()


# --- Upload + Analyze ---

@router.post("/upload")
async def upload_resume(
    user: AuthUser = Depends(get_current_user),
    file: UploadFile = File(...),
    resume_text: Optional[str] = Form(None),
    job_id: Optional[str] = Form(None),
):
    """Upload resume file, parse into sections, and run AI analysis.

    Creates a resume record, parses sections, runs 8-dimension analysis.
    If a master resume already exists (and no job_id), it replaces it.
    """
    db = get_supabase()

    content = await file.read()
    text = resume_text or content.decode("utf-8", errors="ignore")

    # Upsert resume record
    resume_data = {
        "user_id": user.id,
        "name": "Master Resume" if not job_id else f"Resume for Job",
        "original_file_name": file.filename,
        "raw_text": text,
        "updated_at": "now()",
    }
    if job_id:
        resume_data["job_id"] = job_id

    # Check if resume exists
    query = db.table("resume").select("id").eq("user_id", user.id)
    if job_id:
        query = query.eq("job_id", job_id)
    else:
        query = query.is_("job_id", "null")
    existing = query.maybe_single().execute()

    if existing and existing.data:
        resume_id = existing.data["id"]
        db.table("resume").update(resume_data).eq("id", resume_id).execute()
        # Clear old sections
        db.table("resume_section").delete().eq("resume_id", resume_id).execute()
        # Clear old analysis
        db.table("resume_analysis_v2").delete().eq("resume_id", resume_id).execute()
    else:
        resp = db.table("resume").insert(resume_data).execute()
        resume_id = resp.data[0]["id"]

    # Build user context for AI calls
    user_context = await coach.build_user_context(user.id)

    # Parse sections
    sections = await resume_parser.parse_sections(text, user_context)
    for section in sections:
        db.table("resume_section").insert({
            "resume_id": resume_id,
            "section_type": section["section_type"],
            "sort_order": section.get("sort_order", 0),
            "content": section["content"],
        }).execute()

    # Run analysis
    analysis = await resume_service.analyze_resume(text, user_context)

    # Save to resume_analysis_v2
    analysis_data = {
        "resume_id": resume_id,
        "depth_level": "standard",
        "overall_grade": analysis.get("overall_grade") or analysis.get("overall", "N/A"),
        "ats_compatibility": analysis.get("ats_compatibility"),
        "recruiter_scan": analysis.get("recruiter_scan"),
        "bullet_quality": analysis.get("bullet_quality"),
        "seniority_calibration": analysis.get("seniority_calibration"),
        "keyword_coverage": analysis.get("keyword_coverage"),
        "structure_layout": analysis.get("structure_layout"),
        "consistency_polish": analysis.get("consistency_polish"),
        "concern_management": analysis.get("concern_management"),
        "top_fixes": analysis.get("top_fixes", []),
        "concern_mitigations": analysis.get("concern_mitigations", []),
        "positioning_strengths": analysis.get("positioning_strengths"),
        "likely_concerns": analysis.get("likely_concerns"),
        "career_narrative_gaps": analysis.get("career_narrative_gaps"),
        "story_seeds": analysis.get("story_seeds", []),
        "cross_surface_gaps": analysis.get("cross_surface_gaps", []),
    }
    db.table("resume_analysis_v2").insert(analysis_data).execute()

    # Also save to legacy resume_analysis for backward compat
    await resume_service.save_analysis(user.id, analysis)

    return {"resume_id": resume_id, "analysis": analysis_data, "sections_count": len(sections)}


# --- Read Resume (with sections + analysis) ---

@router.get("")
async def get_resume(
    user: AuthUser = Depends(get_current_user),
    job_id: Optional[str] = None,
):
    """Get the active resume for the current workspace context."""
    db = get_supabase()

    # Resolve resume: job-specific or master
    query = db.table("resume").select("*").eq("user_id", user.id)
    if job_id:
        query = query.eq("job_id", job_id)
    else:
        query = query.is_("job_id", "null")
    resume_resp = query.maybe_single().execute()

    # Fallback to master if job-specific not found
    if (not resume_resp or not resume_resp.data) and job_id:
        resume_resp = (
            db.table("resume").select("*")
            .eq("user_id", user.id)
            .is_("job_id", "null")
            .maybe_single().execute()
        )

    if not resume_resp or not resume_resp.data:
        return {"resume": None, "sections": [], "analysis": None}

    resume = resume_resp.data
    resume_id = resume["id"]

    # Fetch sections
    sections_resp = (
        db.table("resume_section").select("*")
        .eq("resume_id", resume_id)
        .order("sort_order")
        .execute()
    )
    sections = sections_resp.data or []

    # Fetch analysis
    analysis_resp = (
        db.table("resume_analysis_v2").select("*")
        .eq("resume_id", resume_id)
        .maybe_single().execute()
    )
    analysis = analysis_resp.data if analysis_resp else None

    return {"resume": resume, "sections": sections, "analysis": analysis}


# --- Section CRUD ---

class SectionUpdate(BaseModel):
    content: dict

@router.put("/sections/{section_id}")
async def update_section(
    section_id: str,
    req: SectionUpdate,
    user: AuthUser = Depends(get_current_user),
):
    """Update a resume section's content (inline editing)."""
    db = get_supabase()

    # Verify ownership
    section = db.table("resume_section").select("resume_id").eq("id", section_id).maybe_single().execute()
    if not section or not section.data:
        raise HTTPException(404, "Section not found")

    resume = db.table("resume").select("user_id").eq("id", section.data["resume_id"]).maybe_single().execute()
    if not resume or not resume.data or resume.data["user_id"] != user.id:
        raise HTTPException(403, "Not authorized")

    resp = db.table("resume_section").update({
        "content": req.content,
        "updated_at": "now()",
    }).eq("id", section_id).execute()

    return resp.data[0]


# --- Coach Chat (SSE Streaming) ---

class ResumeChatRequest(BaseModel):
    resume_id: str
    messages: list[dict]
    session_id: Optional[str] = None

@router.post("/chat")
async def resume_chat(
    req: ResumeChatRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Stream a resume coaching conversation via SSE."""
    db = get_supabase()

    # Verify resume ownership
    resume = db.table("resume").select("*").eq("id", req.resume_id).maybe_single().execute()
    if not resume or not resume.data or resume.data["user_id"] != user.id:
        raise HTTPException(403, "Not authorized")

    user_context = await coach.build_user_context(user.id)

    # Inject resume context into the conversation
    resume_sections = (
        db.table("resume_section").select("*")
        .eq("resume_id", req.resume_id)
        .order("sort_order").execute()
    )
    resume_analysis = (
        db.table("resume_analysis_v2").select("*")
        .eq("resume_id", req.resume_id)
        .maybe_single().execute()
    )

    sections_text = ""
    if resume_sections and resume_sections.data:
        for s in resume_sections.data:
            sections_text += f"\n[{s['section_type']}] {json_mod.dumps(s['content'])}"

    analysis_text = ""
    if resume_analysis and resume_analysis.data:
        a = resume_analysis.data
        analysis_text = (
            f"\nGrade: {a.get('overall_grade')}, "
            f"ATS: {a.get('ats_compatibility')}, "
            f"Bullets: {a.get('bullet_quality')}, "
            f"Top fixes: {json_mod.dumps(a.get('top_fixes', []))}"
        )

    # Prepend resume context as a system-level note in the first message
    context_msg = {
        "role": "user",
        "content": (
            f"[CONTEXT — Resume sections:{sections_text}\n"
            f"Analysis:{analysis_text}]\n\n"
            f"Help me improve my resume based on the analysis above."
        ),
    }

    # Build messages: context + conversation history
    chat_messages = [context_msg] + [
        {"role": m.get("role", "user"), "content": m.get("content", "")}
        for m in req.messages
    ]

    # Create or get session
    session_id = req.session_id
    if not session_id:
        resp = db.table("resume_coach_session").insert({
            "resume_id": req.resume_id,
            "status": "active",
        }).execute()
        session_id = resp.data[0]["id"]

    async def event_stream():
        full_response = ""
        EDIT_MARKER = "|||SUGGESTED_EDIT|||"
        emit_buffer = ""
        edit_started = False

        async for token in coach.coach_stream("resume_chat", user_context, chat_messages):
            full_response += token

            if edit_started:
                continue

            emit_buffer += token

            if EDIT_MARKER in emit_buffer:
                before = emit_buffer.split(EDIT_MARKER)[0]
                if before:
                    yield f"event: token\ndata: {json_mod.dumps({'text': before})}\n\n"
                edit_started = True
                continue

            # Partial marker check
            might_be = False
            for i in range(1, min(len(EDIT_MARKER), len(emit_buffer)) + 1):
                if EDIT_MARKER.startswith(emit_buffer[-i:]):
                    might_be = True
                    break

            if not might_be:
                yield f"event: token\ndata: {json_mod.dumps({'text': emit_buffer})}\n\n"
                emit_buffer = ""

        if emit_buffer and not edit_started:
            yield f"event: token\ndata: {json_mod.dumps({'text': emit_buffer})}\n\n"

        # Check for suggested edits
        if "|||SUGGESTED_EDIT|||" in full_response and "|||END_EDIT|||" in full_response:
            json_str = full_response.split("|||SUGGESTED_EDIT|||")[1].split("|||END_EDIT|||")[0].strip()
            try:
                edits = json_mod.loads(json_str)
                yield f"event: suggested_edit\ndata: {json_mod.dumps(edits)}\n\n"
            except json_mod.JSONDecodeError:
                pass

        # Persist messages
        visible = full_response
        if "|||SUGGESTED_EDIT" in visible:
            visible = visible.split("|||SUGGESTED_EDIT")[0].strip()

        if visible:
            # Save user message
            if req.messages:
                last_user = req.messages[-1]
                db.table("resume_coach_message").insert({
                    "session_id": session_id,
                    "role": "user",
                    "content": last_user.get("content", ""),
                }).execute()

            # Save coach response
            db.table("resume_coach_message").insert({
                "session_id": session_id,
                "role": "assistant",
                "content": visible,
            }).execute()

        yield f"event: session\ndata: {json_mod.dumps({'session_id': session_id})}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# --- Coach Session ---

@router.get("/chat/session")
async def get_coach_session(
    resume_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Get active coach session and messages for a resume."""
    db = get_supabase()

    session = (
        db.table("resume_coach_session").select("*")
        .eq("resume_id", resume_id)
        .eq("status", "active")
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single().execute()
    )

    if not session or not session.data:
        return {"session": None, "messages": []}

    messages = (
        db.table("resume_coach_message").select("*")
        .eq("session_id", session.data["id"])
        .order("created_at")
        .execute()
    )

    return {"session": session.data, "messages": messages.data or []}
```

**Step 2: Register the router in main.py**

In `backend/main.py`, add to line 9 imports:
```python
from backend.api.routers import auth, questions, practice, stories, workspaces, prep, progress, materials, billing, voice, resume
```

Add after line 31 (`app.include_router(voice.router)`):
```python
app.include_router(resume.router)
```

**Step 3: Add resume_chat prompt module**

Create `backend/api/prompts/resume_chat.txt`:
```text
## Resume Coach

You are a resume optimization coach. You help candidates improve their resume through conversational coaching.

Your capabilities:
- Rewrite specific bullets using the XYZ formula (Accomplished X measured by Y by doing Z)
- Apply the "So What?" test to strengthen weak bullets
- Optimize for ATS keyword matching
- Calibrate seniority signaling (verb choices, scope language)
- Improve professional summaries
- Manage interviewer concerns through strategic positioning

When suggesting a specific edit to a resume section, format it as:
- Quote the original text
- Provide your rewritten version
- Explain why the change improves the resume

Focus on high-impact changes first. Reference the resume analysis to guide priorities.
Be direct and specific — never give generic advice.
```

**Step 4: Register the prompt module in PromptComposer**

In `backend/api/services/prompt_composer.py`, add to `COMMAND_MODULES` dict (after line 35):
```python
"resume_chat": ["differentiation", "cross_cutting", "resume_chat"],
```

**Step 5: Update ResumeService.analyze_resume to return 8 dimensions**

In `backend/api/services/resume_service.py`, update the `analyze_resume` method (lines 16-35) to request the additional fields:

Replace the message string (lines 18-33) with:
```python
message = (
    f"## Resume Content\n{resume_text[:5000]}\n\n"
    f"## Instructions\n"
    f"Analyze this resume across 8 dimensions. Return JSON with:\n"
    f"- overall_grade: letter grade A through D\n"
    f"- positioning_strengths: what the resume communicates well\n"
    f"- likely_concerns: what an interviewer might question\n"
    f"- career_narrative_gaps: where the career story has gaps\n"
    f"- story_seeds: list of objects with 'title', 'source_bullet', 'potential_skill'\n"
    f"- ats_compatibility: 'ATS-Ready' or 'ATS-Risky' or 'ATS-Broken' with rationale\n"
    f"- recruiter_scan: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
    f"- bullet_quality: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
    f"- seniority_calibration: 'Aligned' or 'Mismatched' with rationale\n"
    f"- keyword_coverage: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
    f"- structure_layout: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
    f"- consistency_polish: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
    f"- concern_management: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
    f"- top_fixes: ordered list of 5 highest-impact changes, "
    f"each with 'severity' ('red'/'amber'/'neutral'), 'dimension', 'text', 'fix'\n"
    f"- concern_mitigations: list of objects with 'concern' and 'mitigation_language'\n"
    f"- cross_surface_gaps: empty array (populated later when LinkedIn data exists)"
)
```

**Step 6: Verify backend starts**

Run: `cd /Users/mayankverma/Desktop/MayankApps/five-minute-mock-coach && python -c "from backend.api.routers.resume import router; print('Router OK')"`
Expected: `Router OK`

**Step 7: Commit**

```bash
git add backend/api/routers/resume.py backend/main.py backend/api/prompts/resume_chat.txt backend/api/services/prompt_composer.py backend/api/services/resume_service.py backend/api/services/resume_parser.py
git commit -m "feat: add /api/resume router with upload, parse, analyze, section CRUD, and coach chat"
```

---

## Phase 4: Resume Frontend — Page + Upload + Analysis

### Task 7: Create useResume hook

**Files:**
- Create: `frontend/src/hooks/useResume.ts`

**Step 1: Write the hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

export interface ResumeSection {
  id: string;
  resume_id: string;
  section_type: 'summary' | 'experience' | 'education' | 'skills' | 'certifications';
  sort_order: number;
  content: Record<string, any>;
  updated_at: string;
}

export interface ResumeAnalysis {
  id: string;
  resume_id: string;
  depth_level: string;
  overall_grade: string;
  ats_compatibility: string;
  recruiter_scan: string;
  bullet_quality: string;
  seniority_calibration: string;
  keyword_coverage: string;
  structure_layout: string;
  consistency_polish: string;
  concern_management: string;
  top_fixes: { severity: string; dimension: string; text: string; fix: string }[];
  concern_mitigations: { concern: string; mitigation_language: string }[];
  positioning_strengths: string;
  likely_concerns: string;
  career_narrative_gaps: string;
  story_seeds: { title: string; source_bullet: string; potential_skill: string }[];
  cross_surface_gaps: any[];
}

export interface Resume {
  id: string;
  user_id: string;
  job_id: string | null;
  name: string;
  original_file_name: string | null;
  raw_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumeData {
  resume: Resume | null;
  sections: ResumeSection[];
  analysis: ResumeAnalysis | null;
}

export function useResume() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<ResumeData>({
    queryKey: ['resume', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/api/resume');
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !authLoading,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/api/resume/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 min for AI analysis
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume'] });
    },
  });

  const updateSection = useMutation({
    mutationFn: async ({ sectionId, content }: { sectionId: string; content: Record<string, any> }) => {
      const { data } = await api.put(`/api/resume/sections/${sectionId}`, { content });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume'] });
    },
  });

  return {
    resume: query.data?.resume ?? null,
    sections: query.data?.sections ?? [],
    analysis: query.data?.analysis ?? null,
    isLoading: authLoading || query.isLoading,
    hasResume: !!query.data?.resume,
    upload: uploadMutation,
    updateSection,
  };
}
```

**Step 2: Commit**

```bash
git add frontend/src/hooks/useResume.ts
git commit -m "feat: add useResume hook with upload mutation and section update"
```

### Task 8: Build the ResumePage component — empty state

**Files:**
- Modify: `frontend/src/pages/ResumePage.tsx` (replace stub)
- Create: `frontend/src/pages/resume-page.css`

**Step 1: Write the CSS**

Create `frontend/src/pages/resume-page.css`:
```css
/* Resume Page */
.resume-page { display: flex; flex-direction: column; height: calc(100vh - var(--topbar-h) - 48px); }

/* Upload dropzone (empty state) */
.resume-dropzone {
  flex: 1; display: flex; align-items: center; justify-content: center;
  border: 2px dashed var(--border-light); border-radius: var(--radius-md);
  background: var(--card); cursor: pointer; transition: border-color 0.2s, background 0.2s;
}
.resume-dropzone:hover,
.resume-dropzone.dragging { border-color: var(--primary); background: rgba(74, 158, 143, 0.04); }
.resume-dropzone-inner { text-align: center; max-width: 400px; }
.resume-dropzone-icon { width: 56px; height: 56px; margin: 0 auto 16px; color: var(--text-muted); }
.resume-dropzone-title { font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
.resume-dropzone-desc { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 16px; }
.resume-dropzone-hint { font-size: 12px; color: var(--text-muted); margin-top: 12px; }

/* Uploading state */
.resume-uploading { flex: 1; display: flex; align-items: center; justify-content: center; }
.resume-uploading-inner { text-align: center; }
.resume-uploading-spinner {
  width: 40px; height: 40px; border: 3px solid var(--border-light);
  border-top-color: var(--primary); border-radius: 50%;
  animation: spin 0.8s linear infinite; margin: 0 auto 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.resume-uploading-text { font-size: 14px; color: var(--text-muted); }

/* Split pane layout */
.resume-split { flex: 1; display: flex; gap: 0; min-height: 0; overflow: hidden; }
.resume-builder-panel {
  flex: 1; overflow-y: auto; padding: 20px; min-width: 0;
  border-right: 1px solid var(--border-light);
}
.resume-right-panel {
  width: 400px; flex-shrink: 0; overflow-y: auto; padding: 20px;
  display: flex; flex-direction: column;
}

/* Builder sections */
.rb-section {
  background: var(--card); border: 1px solid var(--border-light);
  border-radius: var(--radius-sm); padding: 16px; margin-bottom: 12px;
}
.rb-section-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;
}
.rb-section-type {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  color: var(--text-muted); letter-spacing: 0.5px;
}
.rb-section-edit {
  font-size: 11px; color: var(--primary); cursor: pointer;
  background: none; border: none; padding: 2px 6px;
}
.rb-section-edit:hover { text-decoration: underline; }
.rb-company { font-size: 14px; font-weight: 600; color: var(--text); }
.rb-title { font-size: 13px; color: var(--text-secondary); }
.rb-dates { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
.rb-bullets { list-style: disc; padding-left: 18px; }
.rb-bullets li { font-size: 13px; color: var(--text); line-height: 1.6; margin-bottom: 4px; }
.rb-text { font-size: 13px; color: var(--text); line-height: 1.6; }
.rb-skills-group { margin-bottom: 8px; }
.rb-skills-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; }
.rb-skill-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.rb-skill-tag {
  font-size: 11px; padding: 2px 8px; background: var(--bg);
  border-radius: var(--radius-xs); color: var(--text-secondary);
}

/* Analysis card */
.ra-card {
  background: var(--card); border: 1px solid var(--border-light);
  border-radius: var(--radius-sm); padding: 20px;
}
.ra-grade-row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.ra-grade-circle {
  width: 56px; height: 56px; border-radius: 50%; border: 3px solid var(--primary);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700; color: var(--primary);
}
.ra-grade-label { font-size: 13px; color: var(--text-muted); }
.ra-dims { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 16px; }
.ra-dim {
  font-size: 12px; display: flex; align-items: center; gap: 6px;
}
.ra-dim-label { color: var(--text-muted); }
.ra-dim-value { font-weight: 600; color: var(--text); }
.ra-dim-value.strong { color: var(--primary); }
.ra-dim-value.moderate { color: #c0952a; }
.ra-dim-value.weak { color: #c0392b; }
.ra-fixes-title {
  font-size: 12px; font-weight: 600; text-transform: uppercase;
  color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 8px;
}
.ra-fix { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
.ra-fix-severity {
  font-size: 10px; font-weight: 600; padding: 2px 6px;
  border-radius: var(--radius-xs); flex-shrink: 0; margin-top: 1px;
}
.ra-fix-severity.red { background: #fde8e8; color: #c0392b; }
.ra-fix-severity.amber { background: #fef3cd; color: #856404; }
.ra-fix-severity.neutral { background: var(--bg); color: var(--text-muted); }
.ra-fix-text { font-size: 12px; color: var(--text); line-height: 1.5; }
.ra-seeds-title {
  font-size: 12px; font-weight: 600; text-transform: uppercase;
  color: var(--text-muted); letter-spacing: 0.5px; margin: 16px 0 8px;
}
.ra-seed { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.ra-seed-text { font-size: 12px; color: var(--text); flex: 1; }
.ra-seed-btn {
  font-size: 11px; color: var(--primary); background: none; border: none;
  cursor: pointer; padding: 2px 6px; white-space: nowrap;
}
.ra-seed-btn:hover { text-decoration: underline; }

/* Refine with coach button */
.ra-refine-btn {
  width: 100%; margin-top: 16px; padding: 10px; font-size: 13px; font-weight: 600;
  background: var(--primary); color: white; border: none; border-radius: var(--radius-sm);
  cursor: pointer; transition: opacity 0.2s;
}
.ra-refine-btn:hover { opacity: 0.9; }

/* Page header */
.resume-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px; flex-shrink: 0;
}
.resume-header h1 { font-size: 18px; font-weight: 700; }

/* Responsive */
@media (max-width: 900px) {
  .resume-right-panel { width: 320px; }
}
@media (max-width: 768px) {
  .resume-split { flex-direction: column; }
  .resume-builder-panel { border-right: none; border-bottom: 1px solid var(--border-light); }
  .resume-right-panel { width: 100%; }
}
```

**Step 2: Write the ResumePage component**

Replace `frontend/src/pages/ResumePage.tsx`:
```tsx
import { useRef, useState, DragEvent } from 'react';
import { useResume } from '../hooks/useResume';
import type { ResumeSection, ResumeAnalysis } from '../hooks/useResume';
import './resume-page.css';

/* ── Icons ── */
function UploadIcon() {
  return (
    <svg className="resume-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

/* ── Analysis Card ── */
function AnalysisCard({ analysis }: { analysis: ResumeAnalysis }) {
  const dims = [
    { label: 'ATS', value: analysis.ats_compatibility },
    { label: 'Recruiter Scan', value: analysis.recruiter_scan },
    { label: 'Bullet Quality', value: analysis.bullet_quality },
    { label: 'Seniority', value: analysis.seniority_calibration },
    { label: 'Keywords', value: analysis.keyword_coverage },
    { label: 'Structure', value: analysis.structure_layout },
    { label: 'Concerns', value: analysis.concern_management },
    { label: 'Polish', value: analysis.consistency_polish },
  ];

  function dimClass(val: string | null) {
    if (!val) return '';
    const v = val.toLowerCase();
    if (v.includes('strong') || v.includes('ready') || v.includes('aligned')) return 'strong';
    if (v.includes('moderate') || v.includes('risky')) return 'moderate';
    if (v.includes('weak') || v.includes('broken') || v.includes('mismatched')) return 'weak';
    return '';
  }

  return (
    <div className="ra-card">
      <div className="ra-grade-row">
        <div className="ra-grade-circle">{analysis.overall_grade || '?'}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Resume Score</div>
          <div className="ra-grade-label">{analysis.depth_level} analysis</div>
        </div>
      </div>

      <div className="ra-dims">
        {dims.map((d) => (
          <div key={d.label} className="ra-dim">
            <span className="ra-dim-label">{d.label}</span>
            <span className={`ra-dim-value ${dimClass(d.value)}`}>
              {d.value ? d.value.split(' ')[0] : 'N/A'}
            </span>
          </div>
        ))}
      </div>

      {analysis.top_fixes && analysis.top_fixes.length > 0 && (
        <>
          <div className="ra-fixes-title">Top Fixes</div>
          {analysis.top_fixes.map((fix, i) => (
            <div key={i} className="ra-fix">
              <span className={`ra-fix-severity ${fix.severity || 'neutral'}`}>
                {fix.severity === 'red' ? 'Fix' : fix.severity === 'amber' ? 'Improve' : 'Nice'}
              </span>
              <span className="ra-fix-text">{fix.text || fix.fix}</span>
            </div>
          ))}
        </>
      )}

      {analysis.story_seeds && analysis.story_seeds.length > 0 && (
        <>
          <div className="ra-seeds-title">Story Seeds</div>
          {analysis.story_seeds.map((seed, i) => (
            <div key={i} className="ra-seed">
              <span className="ra-seed-text">{seed.title || seed.source_bullet}</span>
              <button className="ra-seed-btn">Add to Storybank</button>
            </div>
          ))}
        </>
      )}

      <button className="ra-refine-btn">Refine with Coach</button>
    </div>
  );
}

/* ── Builder Section ── */
function BuilderSection({ section }: { section: ResumeSection }) {
  const { content, section_type } = section;

  if (section_type === 'summary') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Summary</span>
          <button className="rb-section-edit">edit</button>
        </div>
        <p className="rb-text">{content.text}</p>
      </div>
    );
  }

  if (section_type === 'experience') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Experience</span>
          <button className="rb-section-edit">edit</button>
        </div>
        <div className="rb-company">{content.company}</div>
        <div className="rb-title">{content.title}</div>
        <div className="rb-dates">
          {content.start_date} — {content.end_date || 'Present'}
          {content.location && ` · ${content.location}`}
        </div>
        {content.bullets && (
          <ul className="rb-bullets">
            {content.bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}
          </ul>
        )}
      </div>
    );
  }

  if (section_type === 'education') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Education</span>
          <button className="rb-section-edit">edit</button>
        </div>
        <div className="rb-company">{content.institution}</div>
        <div className="rb-title">{content.degree}{content.field ? ` — ${content.field}` : ''}</div>
        {content.graduation_date && <div className="rb-dates">{content.graduation_date}</div>}
      </div>
    );
  }

  if (section_type === 'skills') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Skills</span>
          <button className="rb-section-edit">edit</button>
        </div>
        {content.categories?.map((cat: { name: string; skills: string[] }, i: number) => (
          <div key={i} className="rb-skills-group">
            <div className="rb-skills-label">{cat.name}</div>
            <div className="rb-skill-tags">
              {cat.skills.map((s: string) => <span key={s} className="rb-skill-tag">{s}</span>)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (section_type === 'certifications') {
    return (
      <div className="rb-section">
        <div className="rb-section-header">
          <span className="rb-section-type">Certifications</span>
          <button className="rb-section-edit">edit</button>
        </div>
        {content.items?.map((c: { name: string; issuer: string; date: string }, i: number) => (
          <div key={i} className="rb-text">{c.name} — {c.issuer} ({c.date})</div>
        ))}
      </div>
    );
  }

  return null;
}

/* ── Main Page ── */
export function ResumePage() {
  const { resume, sections, analysis, isLoading, hasResume, upload } = useResume();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File) {
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.docx'))) {
      upload.mutate(file);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  if (isLoading) {
    return <div className="resume-page"><div className="resume-uploading"><div className="resume-uploading-inner"><div className="resume-uploading-spinner" /><div className="resume-uploading-text">Loading...</div></div></div></div>;
  }

  // Uploading state
  if (upload.isPending) {
    return (
      <div className="resume-page">
        <div className="resume-uploading">
          <div className="resume-uploading-inner">
            <div className="resume-uploading-spinner" />
            <div className="resume-uploading-text">Analyzing your resume...</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Parsing sections, running 8-dimension audit, and extracting story seeds.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state — no resume uploaded
  if (!hasResume) {
    return (
      <div className="resume-page">
        <div className="resume-header"><h1>Resume</h1></div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <div
          className={`resume-dropzone${dragging ? ' dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="resume-dropzone-inner">
            <UploadIcon />
            <div className="resume-dropzone-title">Upload your resume to get started</div>
            <div className="resume-dropzone-desc">
              Get an ATS compatibility audit, story seeds for your storybank, and a structured resume you can iterate on with your AI coach.
            </div>
            <button className="btn btn-primary">Upload Resume</button>
            <div className="resume-dropzone-hint">Accepts PDF and DOCX — or drag and drop</div>
          </div>
        </div>
      </div>
    );
  }

  // Main state — split pane with builder (left) + analysis (right)
  return (
    <div className="resume-page">
      <div className="resume-header">
        <h1>Resume</h1>
        <button
          className="btn btn-sm"
          style={{ fontSize: 12 }}
          onClick={() => inputRef.current?.click()}
        >
          Re-upload
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      <div className="resume-split">
        <div className="resume-builder-panel">
          {sections.map((section) => (
            <BuilderSection key={section.id} section={section} />
          ))}
          {sections.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              No sections parsed yet.
            </div>
          )}
        </div>

        <div className="resume-right-panel">
          {analysis ? (
            <AnalysisCard analysis={analysis} />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              No analysis available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Verify**

Run: `cd frontend && npm run build`
Expected: Clean build.

**Step 4: Commit**

```bash
git add frontend/src/pages/ResumePage.tsx frontend/src/pages/resume-page.css frontend/src/hooks/useResume.ts
git commit -m "feat: build ResumePage with upload dropzone, builder panel, and analysis card"
```

---

## Phase 5: LinkedIn, Pitch, Outreach Pages

### Task 9: Build LinkedInPage

**Files:**
- Modify: `frontend/src/pages/LinkedInPage.tsx` (replace stub)

**Step 1: Write the component**

```tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import './pages.css';

export function LinkedInPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [profileText, setProfileText] = useState('');

  const linkedinQuery = useQuery({
    queryKey: ['linkedin', user?.id],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/materials/linkedin');
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !authLoading,
  });

  const auditMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data } = await api.post('/api/materials/linkedin/audit', { linkedin_text: text });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin'] });
    },
  });

  const analysis = linkedinQuery.data;

  // Empty state — no audit yet
  if (!analysis && !auditMutation.isPending) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">LinkedIn</h1>
          <p className="page-subtitle">Get a section-by-section audit calibrated to how recruiters search and scan profiles.</p>
        </div>
        <div className="card">
          <div className="card-body">
            <textarea
              value={profileText}
              onChange={(e) => setProfileText(e.target.value)}
              placeholder="Paste your LinkedIn profile text here..."
              rows={8}
              style={{ width: '100%', fontSize: 13, padding: 12, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', resize: 'vertical', fontFamily: 'var(--ff-body)' }}
            />
            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => auditMutation.mutate(profileText)}
              disabled={!profileText.trim()}
            >
              Start Audit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (auditMutation.isPending) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">LinkedIn</h1>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
            <div className="resume-uploading-spinner" style={{ width: 32, height: 32, margin: '0 auto 12px', border: '3px solid var(--border-light)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Auditing your LinkedIn profile...</div>
          </div>
        </div>
      </div>
    );
  }

  // Results
  const dims = [
    { label: 'Recruiter Discoverability', value: analysis.recruiter_discoverability },
    { label: 'Credibility', value: analysis.credibility_score },
    { label: 'Differentiation', value: analysis.differentiation_score },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">LinkedIn</h1>
        <p className="page-subtitle">Profile audit results</p>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Audit Results</span>
          <button className="btn btn-sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['linkedin'] })}>Re-audit</button>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 13, marginBottom: 16 }}>{analysis.overall}</p>
          <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
            {dims.map((d) => (
              <div key={d.label} style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>{d.label}: </span>
                <span style={{ fontWeight: 600 }}>{d.value}</span>
              </div>
            ))}
          </div>
          {analysis.top_fixes && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Top Fixes</div>
              {analysis.top_fixes.map((fix: any, i: number) => (
                <div key={i} style={{ fontSize: 12, marginBottom: 8 }}>
                  <strong>{fix.section}:</strong> {fix.issue} — <em>{fix.fix}</em>
                </div>
              ))}
            </>
          )}
          {analysis.positioning_gaps && (
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              <strong>Positioning Gaps:</strong> {analysis.positioning_gaps}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/LinkedInPage.tsx
git commit -m "feat: build LinkedInPage with profile text input, audit trigger, and results display"
```

### Task 10: Build PitchPage

**Files:**
- Modify: `frontend/src/pages/PitchPage.tsx` (replace stub)

**Step 1: Write the component**

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useResume } from '../hooks/useResume';
import api from '../lib/api';
import './pages.css';

export function PitchPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasResume } = useResume();
  const queryClient = useQueryClient();

  const pitchQuery = useQuery({
    queryKey: ['pitch', user?.id],
    queryFn: async () => {
      try {
        const { data } = await api.get('/api/materials/pitch');
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !authLoading,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/materials/pitch/generate');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pitch'] });
    },
  });

  const pitch = pitchQuery.data;

  // Locked state — no resume
  if (!hasResume) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Pitch</h1>
          <p className="page-subtitle">Your positioning statement — the consistency anchor for LinkedIn, outreach, and interviews.</p>
        </div>
        <div className="card">
          <div className="card-body empty-state">
            <div className="empty-state-icon" style={{ fontSize: 32 }}>🔒</div>
            <div className="empty-state-title">Upload your resume to unlock Pitch</div>
            <div className="empty-state-desc">Your positioning statement is generated from your resume analysis.</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => window.location.href = '/resume'}>Go to Resume</button>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (generateMutation.isPending) {
    return (
      <div>
        <div className="page-header"><h1 className="page-title">Pitch</h1></div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Generating your positioning statement...</div>
          </div>
        </div>
      </div>
    );
  }

  // No pitch yet — generate
  if (!pitch) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Pitch</h1>
          <p className="page-subtitle">Generate your positioning statement from your resume analysis.</p>
        </div>
        <div className="card">
          <div className="card-body empty-state">
            <div className="empty-state-title">Ready to generate your pitch</div>
            <div className="empty-state-desc">We'll use your resume analysis to create a core positioning statement with context variants.</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => generateMutation.mutate()}>Generate Pitch</button>
          </div>
        </div>
      </div>
    );
  }

  // Results
  const variants = pitch.variants || {};
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pitch</h1>
        <p className="page-subtitle">Your positioning statement and context variants</p>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <span className="card-title">Core Statement</span>
          <button className="btn btn-sm" onClick={() => generateMutation.mutate()}>Regenerate</button>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>{pitch.core_statement}</p>
          {pitch.key_differentiator && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              <strong>Differentiator:</strong> {pitch.key_differentiator}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header"><span className="card-title">10-Second Hook</span></div>
        <div className="card-body">
          <p style={{ fontSize: 13 }}>{pitch.hook_10s}</p>
        </div>
      </div>

      {variants.networking && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header"><span className="card-title">Networking Variant</span></div>
          <div className="card-body"><p style={{ fontSize: 13 }}>{variants.networking}</p></div>
        </div>
      )}

      {variants.interview_opener && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header"><span className="card-title">Interview Opener (TMAY)</span></div>
          <div className="card-body"><p style={{ fontSize: 13 }}>{variants.interview_opener}</p></div>
        </div>
      )}

      {variants.linkedin_headline && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header"><span className="card-title">LinkedIn Headline</span></div>
          <div className="card-body"><p style={{ fontSize: 13 }}>{variants.linkedin_headline}</p></div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/PitchPage.tsx
git commit -m "feat: build PitchPage with locked state, generation, and variant display"
```

### Task 11: Build OutreachPage

**Files:**
- Modify: `frontend/src/pages/OutreachPage.tsx` (replace stub)

**Step 1: Write the component**

```tsx
import { useState } from 'react';
import { useResume } from '../hooks/useResume';
import './pages.css';

const MESSAGE_TYPES = [
  { key: 'cold_linkedin', label: 'Cold LinkedIn Connection', limit: '300 chars' },
  { key: 'cold_email', label: 'Cold Email', limit: '75-125 words' },
  { key: 'warm_intro', label: 'Warm Intro Request', limit: 'Forwardable blurb' },
  { key: 'informational', label: 'Informational Interview Ask', limit: '' },
  { key: 'recruiter_reply', label: 'Recruiter Reply', limit: '' },
  { key: 'follow_up', label: 'Follow-Up', limit: '' },
  { key: 'post_meeting', label: 'Post-Meeting Follow-Up', limit: '' },
  { key: 'referral', label: 'Referral Request', limit: '' },
];

export function OutreachPage() {
  const { hasResume } = useResume();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Locked state — no resume
  if (!hasResume) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Outreach</h1>
          <p className="page-subtitle">Craft personalized networking messages with your AI coach.</p>
        </div>
        <div className="card">
          <div className="card-body empty-state">
            <div className="empty-state-icon" style={{ fontSize: 32 }}>🔒</div>
            <div className="empty-state-title">Upload your resume to unlock Outreach</div>
            <div className="empty-state-desc">Outreach messages are personalized using your resume and positioning.</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => window.location.href = '/resume'}>Go to Resume</button>
          </div>
        </div>
      </div>
    );
  }

  // Message type selection
  if (!selectedType) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Outreach</h1>
          <p className="page-subtitle">Select a message type to draft.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {MESSAGE_TYPES.map((type) => (
            <div
              key={type.key}
              className="card"
              style={{ cursor: 'pointer', transition: 'border-color 0.2s' }}
              onClick={() => setSelectedType(type.key)}
            >
              <div className="card-body" style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{type.label}</div>
                {type.limit && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{type.limit}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Selected type — placeholder for coach chat integration
  const typeInfo = MESSAGE_TYPES.find((t) => t.key === selectedType);
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Outreach</h1>
        <p className="page-subtitle">{typeInfo?.label}</p>
      </div>
      <button className="btn btn-sm" style={{ marginBottom: 16 }} onClick={() => setSelectedType(null)}>
        Back to message types
      </button>
      <div className="card">
        <div className="card-body empty-state">
          <div className="empty-state-title">Coach chat for {typeInfo?.label}</div>
          <div className="empty-state-desc">
            The AI coach will ask for target context and draft a personalized message.
            Coach chat integration coming next.
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/OutreachPage.tsx
git commit -m "feat: build OutreachPage with locked state and message type selector"
```

---

## Phase 6: Cleanup and Polish

### Task 12: Remove old Materials page and update imports

**Files:**
- Modify: `frontend/src/App.tsx` — remove `/materials` route and `Materials` import
- Delete or deprecate: `frontend/src/pages/Materials.tsx` — no longer needed
- Modify: `frontend/src/hooks/useMaterials.ts` — can be removed once all pages use new hooks

**Step 1: Remove Materials route from App.tsx**

Remove the import line:
```typescript
import { Materials } from './pages/Materials';
```

Remove the route:
```typescript
<Route path="/materials" element={<Materials />} />
```

**Step 2: Add a redirect from /materials to /resume**

Add at the top of App.tsx:
```typescript
import { Navigate } from 'react-router-dom';
```

Add where the old `/materials` route was:
```typescript
<Route path="/materials" element={<Navigate to="/resume" replace />} />
```

This preserves any bookmarks or links.

**Step 3: Verify**

Run: `cd frontend && npm run build`
Expected: Clean build, no unused imports.

**Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: replace /materials route with redirect to /resume"
```

### Task 13: Conditional dashboard nudge

The dashboard already has an "Upload Your Resume" banner (Dashboard.tsx lines 372-382). We updated the link in Task 4. Now make it conditional — only show when no resume exists.

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1: Import useResume and conditionally render**

Add import at top:
```typescript
import { useResume } from '../hooks/useResume';
```

In `GeneralDashboard()`, add after the existing hook calls (line 236):
```typescript
const { hasResume } = useResume();
```

Wrap the action banner (lines 372-382) in a conditional:
```tsx
{!hasResume && (
  <div className="action-banner">
    ...existing banner code...
  </div>
)}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: conditionally show resume upload nudge only when no resume exists"
```

---

## Summary

| Phase | Tasks | What Ships |
|-------|-------|-----------|
| 1 — Database | Task 1 | New resume tables + RLS |
| 2 — Navigation | Tasks 2-4 | New routes, sidebar restructure, dashboard link |
| 3 — Resume Backend | Tasks 5-6 | Upload, parse, analyze, section CRUD, coach chat endpoints |
| 4 — Resume Frontend | Tasks 7-8 | Full Resume page: upload dropzone, builder, analysis card |
| 5 — Other Pages | Tasks 9-11 | LinkedIn, Pitch, Outreach pages |
| 6 — Cleanup | Tasks 12-13 | Remove old Materials page, conditional dashboard nudge |

**Total: 13 tasks.** Phases 1-4 form the MVP (Resume page end-to-end). Phases 5-6 complete the full materials section.

**Future work (not in this plan):**
- Resume coach chat frontend (useResumeChat hook + chat panel in right panel)
- Inline section editing in the builder
- JD-targeted optimization (Job Workspace context)
- Story bullet mapping (storybank-to-bullet pipeline)
- Outreach coach chat integration
- Cross-surface consistency checks
