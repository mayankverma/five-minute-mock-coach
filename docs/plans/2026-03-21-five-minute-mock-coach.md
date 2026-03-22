# Five Minute Mock Coach — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack AI interview coaching web app that converts the interview-coach-skill methodology into a product with voice practice, persistent coaching intelligence, job-workspace isolation, and Stripe-gated multi-job access.

**Architecture:** React + Vite + TypeScript frontend talking to a FastAPI (Python) backend. Supabase provides Postgres, Auth (JWT), and file storage. OpenAI powers coaching intelligence via direct API calls with the skill's reference files as prompt modules. ElevenLabs provides voice for mock interviews. Stripe handles payments. Railway deploys both services.

**Tech Stack:** React 18 + Vite + TypeScript | FastAPI + Python 3.12 | Supabase (Postgres + Auth + Storage) | OpenAI API | ElevenLabs ConvAI | Stripe | Railway

**Key Product Decisions:**
- Workspace model: 1 "General Prep" workspace + N job workspaces (1 free, N requires Premium)
- 253 behavioral questions ported from existing 5 Minute Mock question bank with company overlays
- Seniority-calibrated scoring per workspace (same user can apply at different levels)
- Mobile-responsive from day one

**Reference Files:**
- UI mockup: `interview-coach-ui-v2.html` (interactive 7-page app skeleton)
- Coaching methodology: `references/*.md` (11 reference files + 23 command files)
- Existing question bank: `../five-minute-mock-mvp/web/data/behavioral_questions.json` (253 questions)
- Company overlays: `../five-minute-mock-mvp/web/data/technology/overlays/*.json`
- Existing auth pattern: `../five-minute-mock-mvp/api/middleware/auth.py`
- Existing ElevenLabs: `../five-minute-mock-mvp/api/services/elevenlabs.py`
- Existing PromptComposer: `../five-minute-mock-mvp/api/services/prompt_composer.py`

---

## Task Dependency Graph

```
Task 1 (Repo Setup)
├── Task 2 (Supabase Schema) ──┐
├── Task 3 (FastAPI Skeleton)──┤
│   └── Task 4 (Auth)─────────┤
│                              ├── Task 7 (AI Coach Service)
│                              ├── Task 8 (Question Bank + Practice API)
│                              ├── Task 9 (Storybank API)
│                              ├── Task 10 (Job Workspace + Prep API)
│                              ├── Task 11 (Scoring + Progress API)
│                              └── Task 12 (Materials API)
│
├── Task 5 (React Skeleton)────┐
│   └── Task 6 (Design System)┤
│                              ├── Task 13 (Dashboard Pages)
│                              ├── Task 14 (Storybank Page)
│                              ├── Task 15 (Practice + Voice Page)
│                              ├── Task 16 (Mock Interview Page)
│                              ├── Task 17 (Interview Prep Page)
│                              ├── Task 18 (Progress Page)
│                              └── Task 19 (Materials Page)
│
├── Task 20 (ElevenLabs Voice Integration)
├── Task 21 (Stripe Integration)
├── Task 22 (Mobile Responsive)
└── Task 23 (Railway Deployment)
```

**Parallelization:** Tasks 2-4 (backend foundation) run parallel with Tasks 5-6 (frontend foundation). Once both foundations are done, Tasks 7-12 (backend APIs) run parallel with Tasks 13-19 (frontend pages). Tasks 20-23 are integrations that layer on top.

---

## Task 1: Repository Setup + Monorepo Structure

**Files:**
- Create: `five-minute-mock-coach/` (new repo root)
- Create: `five-minute-mock-coach/backend/` (FastAPI)
- Create: `five-minute-mock-coach/frontend/` (React + Vite)
- Create: `five-minute-mock-coach/README.md`
- Create: `five-minute-mock-coach/.gitignore`

**Step 1: Create the new repo and monorepo structure**

```bash
cd /Users/mayankverma/Desktop/MayankApps
mkdir five-minute-mock-coach
cd five-minute-mock-coach
git init

mkdir -p backend/{api/{routers,services,prompts,models,db},tests}
mkdir -p frontend
mkdir -p docs/plans
mkdir -p scripts
```

**Step 2: Initialize backend Python project**

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate

cat > requirements.txt << 'EOF'
fastapi==0.115.0
uvicorn[standard]==0.30.0
pydantic==2.9.0
pydantic-settings==2.5.0
python-dotenv==1.0.1
httpx==0.27.0
supabase==2.9.0
openai==1.50.0
stripe==10.0.0
python-jose[cryptography]==3.3.0
python-multipart==0.0.9
websockets==12.0
pytest==8.3.0
pytest-asyncio==0.24.0
EOF

pip install -r requirements.txt
```

**Step 3: Initialize frontend React project**

```bash
cd ../frontend
npm create vite@latest . -- --template react-ts
npm install
npm install react-router-dom @tanstack/react-query axios
npm install -D tailwindcss @tailwindcss/vite
```

Note: We use Tailwind for utility classes but our primary design system comes from CSS custom properties matching the UI mockup. Tailwind supplements, not replaces.

**Step 4: Create .gitignore and .env.example**

`.gitignore`:
```
# Python
backend/.venv/
__pycache__/
*.pyc
.pytest_cache/

# Node
frontend/node_modules/
frontend/dist/

# Env
.env
.env.local
.env.staging

# IDE
.idea/
.vscode/
```

`.env.example`:
```
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# ElevenLabs
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PREMIUM=price_...

# App
ENV=local
DEBUG=true
FRONTEND_URL=http://localhost:5173
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: initialize monorepo — backend (FastAPI) + frontend (React/Vite/TS)"
```

---

## Task 2: Supabase Database Schema

**Files:**
- Create: `backend/db/migrations/001_core_schema.sql`
- Create: `backend/db/migrations/002_question_bank.sql`
- Create: `backend/db/migrations/003_rls_policies.sql`
- Create: `backend/db/seed/questions.py` (seed script to import 253 questions)

**Step 1: Create core schema migration**

`001_core_schema.sql`:
```sql
-- ============================================================
-- USER PROFILE (extends Supabase auth.users)
-- ============================================================
CREATE TABLE user_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    target_roles TEXT[] DEFAULT '{}',
    seniority_band TEXT CHECK (seniority_band IN ('early', 'mid', 'senior', 'executive')),
    track TEXT CHECK (track IN ('quick_prep', 'full')) DEFAULT 'full',
    feedback_directness INTEGER CHECK (feedback_directness BETWEEN 1 AND 5) DEFAULT 3,
    interview_timeline DATE,
    coaching_mode TEXT CHECK (coaching_mode IN ('triage', 'focused', 'full')) DEFAULT 'full',
    interview_history TEXT,
    biggest_concern TEXT,
    anxiety_profile TEXT,
    career_transition TEXT DEFAULT 'none',
    known_interview_formats TEXT[] DEFAULT '{}',
    subscription_tier TEXT CHECK (subscription_tier IN ('free', 'premium')) DEFAULT 'free',
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STORYBANK
-- ============================================================
CREATE TABLE story (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    situation TEXT,
    task TEXT,
    action TEXT,
    result TEXT,
    primary_skill TEXT,
    secondary_skill TEXT,
    earned_secret TEXT,
    strength INTEGER CHECK (strength BETWEEN 1 AND 5),
    use_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    domain TEXT,
    deploy_for TEXT,
    notes TEXT,
    status TEXT CHECK (status IN ('active', 'retired')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_story_user ON story(user_id);

-- ============================================================
-- JOB WORKSPACE (company loop)
-- ============================================================
CREATE TABLE job_workspace (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company_name TEXT NOT NULL,
    role_title TEXT,
    jd_text TEXT,
    status TEXT CHECK (status IN ('decoded', 'researched', 'applied', 'interviewing', 'offer', 'closed', 'archived')) DEFAULT 'decoded',
    seniority_band TEXT CHECK (seniority_band IN ('early', 'mid', 'senior', 'executive')),
    fit_verdict TEXT CHECK (fit_verdict IN ('strong', 'investable_stretch', 'long_shot', 'weak')),
    fit_confidence TEXT CHECK (fit_confidence IN ('limited', 'medium', 'high')),
    fit_signals TEXT,
    structural_gaps TEXT,
    competency_ranking JSONB DEFAULT '[]',
    round_formats JSONB DEFAULT '[]',
    stories_used JSONB DEFAULT '[]',
    concerns JSONB DEFAULT '[]',
    interviewer_intel JSONB DEFAULT '[]',
    prepared_questions TEXT[] DEFAULT '{}',
    next_round_date TIMESTAMPTZ,
    research_data JSONB,
    prep_brief JSONB,
    hype_plan JSONB,
    date_researched TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_workspace_user ON job_workspace(user_id);

-- ============================================================
-- INTERVIEW ROUNDS (per job workspace)
-- ============================================================
CREATE TABLE interview_round (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES job_workspace(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    round_number INTEGER NOT NULL,
    round_type TEXT,
    round_date TIMESTAMPTZ,
    format TEXT,
    duration_minutes INTEGER,
    interviewer_type TEXT,
    result TEXT CHECK (result IN ('advanced', 'rejected', 'pending', 'unknown')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEBRIEF (post-interview capture)
-- ============================================================
CREATE TABLE debrief (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID REFERENCES interview_round(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    questions_asked JSONB DEFAULT '[]',
    stories_used JSONB DEFAULT '[]',
    went_well TEXT,
    went_poorly TEXT,
    confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
    interviewer_reactions TEXT,
    overall_feeling TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCORE HISTORY
-- ============================================================
CREATE TABLE score_entry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    workspace_id UUID REFERENCES job_workspace(id) ON DELETE SET NULL,
    entry_type TEXT CHECK (entry_type IN ('interview', 'practice', 'mock')) NOT NULL,
    context TEXT,
    company TEXT,
    substance NUMERIC(2,1) CHECK (substance BETWEEN 1 AND 5),
    structure NUMERIC(2,1) CHECK (structure BETWEEN 1 AND 5),
    relevance NUMERIC(2,1) CHECK (relevance BETWEEN 1 AND 5),
    credibility NUMERIC(2,1) CHECK (credibility BETWEEN 1 AND 5),
    differentiation NUMERIC(2,1) CHECK (differentiation BETWEEN 1 AND 5),
    hire_signal TEXT CHECK (hire_signal IN ('strong_hire', 'hire', 'mixed', 'no_hire')),
    self_delta TEXT CHECK (self_delta IN ('over', 'under', 'accurate')),
    raw_feedback JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_score_user ON score_entry(user_id);
CREATE INDEX idx_score_workspace ON score_entry(workspace_id);

-- ============================================================
-- PRACTICE SESSION
-- ============================================================
CREATE TABLE practice_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    workspace_id UUID REFERENCES job_workspace(id) ON DELETE SET NULL,
    drill_type TEXT,
    stage INTEGER,
    question_ids TEXT[] DEFAULT '{}',
    transcript TEXT,
    audio_url TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DRILL PROGRESSION
-- ============================================================
CREATE TABLE drill_progression (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    current_stage INTEGER DEFAULT 1,
    gates_passed TEXT[] DEFAULT '{}',
    revisit_queue TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COACHING STRATEGY
-- ============================================================
CREATE TABLE coaching_strategy (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    primary_bottleneck TEXT,
    current_approach TEXT,
    rationale TEXT,
    pivot_conditions TEXT,
    root_causes TEXT[] DEFAULT '{}',
    self_assessment_tendency TEXT CHECK (self_assessment_tendency IN ('over', 'under', 'calibrated', 'unknown')) DEFAULT 'unknown',
    previous_approaches JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INTERVIEW INTELLIGENCE
-- ============================================================
CREATE TABLE interview_pattern (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    pattern_type TEXT CHECK (pattern_type IN ('effective', 'ineffective')) NOT NULL,
    description TEXT NOT NULL,
    evidence TEXT,
    linked_dimension TEXT,
    still_active BOOLEAN DEFAULT TRUE,
    first_detected TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recruiter_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company TEXT,
    source TEXT CHECK (source IN ('recruiter', 'interviewer', 'hiring_manager')),
    feedback_text TEXT NOT NULL,
    linked_dimension TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OUTCOME LOG
-- ============================================================
CREATE TABLE outcome_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company TEXT NOT NULL,
    role TEXT,
    round TEXT,
    result TEXT CHECK (result IN ('advanced', 'rejected', 'pending', 'offer', 'withdrawn')) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APPLICATION MATERIALS
-- ============================================================
CREATE TABLE resume_analysis (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    positioning_strengths TEXT,
    likely_concerns TEXT,
    career_narrative_gaps TEXT,
    story_seeds JSONB DEFAULT '[]',
    ats_compatibility TEXT,
    recruiter_scan TEXT,
    bullet_quality TEXT,
    seniority_calibration TEXT,
    keyword_coverage TEXT,
    top_fixes JSONB DEFAULT '[]',
    resume_file_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE positioning_statement (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    core_statement TEXT,
    hook_10s TEXT,
    key_differentiator TEXT,
    earned_secret_anchor TEXT,
    target_audience TEXT,
    variants JSONB DEFAULT '{}',
    consistency_status TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE linkedin_analysis (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    overall TEXT,
    recruiter_discoverability TEXT,
    credibility_score TEXT,
    differentiation_score TEXT,
    top_fixes JSONB DEFAULT '[]',
    positioning_gaps TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comp_strategy (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    target_range JSONB,
    range_basis TEXT,
    research_completeness TEXT,
    stage_coached TEXT,
    jurisdiction_notes TEXT,
    scripts JSONB DEFAULT '{}',
    key_principle TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SESSION LOG
-- ============================================================
CREATE TABLE session_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    commands_run TEXT[] DEFAULT '{}',
    key_outcomes TEXT,
    coaching_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STORY-SESSION LINK (usage tracking)
-- ============================================================
CREATE TABLE story_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES story(id) ON DELETE CASCADE NOT NULL,
    session_id UUID REFERENCES practice_session(id) ON DELETE CASCADE,
    round_id UUID REFERENCES interview_round(id) ON DELETE CASCADE,
    context TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Step 2: Create question bank migration**

`002_question_bank.sql`:
```sql
-- ============================================================
-- QUESTION BANK (seeded from existing 5 Minute Mock data)
-- ============================================================
CREATE TABLE question (
    id TEXT PRIMARY KEY,  -- e.g., "BQ-001"
    title TEXT NOT NULL,
    question_text TEXT NOT NULL,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
    category TEXT DEFAULT 'behavioral',
    theme TEXT,
    explanation TEXT,
    tags JSONB DEFAULT '[]',
    frequency TEXT DEFAULT 'medium',
    time_to_answer_seconds INTEGER DEFAULT 180,
    variations JSONB DEFAULT '[]',
    follow_up_questions JSONB DEFAULT '[]',
    levels_applicable TEXT[] DEFAULT '{}',
    roles_applicable TEXT[] DEFAULT '{}',
    guidance JSONB,  -- what_good_looks_like, common_pitfalls, answer_structure, level_signals
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_question_theme ON question(theme);
CREATE INDEX idx_question_difficulty ON question(difficulty);

-- Company-question mapping (which companies ask which questions)
CREATE TABLE question_company_map (
    question_id TEXT REFERENCES question(id) ON DELETE CASCADE,
    company_key TEXT NOT NULL,
    frequency_at_company TEXT DEFAULT 'medium',
    typical_round TEXT,
    company_specific_guidance JSONB,
    PRIMARY KEY (question_id, company_key)
);

CREATE INDEX idx_qcm_company ON question_company_map(company_key);

-- User's question history (tracks which questions they've seen/practiced)
CREATE TABLE user_question_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    question_id TEXT REFERENCES question(id) ON DELETE CASCADE NOT NULL,
    workspace_id UUID REFERENCES job_workspace(id) ON DELETE SET NULL,
    score_avg NUMERIC(2,1),
    times_practiced INTEGER DEFAULT 1,
    last_practiced TIMESTAMPTZ DEFAULT NOW(),
    outcome TEXT CHECK (outcome IN ('advanced', 'rejected', 'pending', 'unknown')),
    source TEXT CHECK (source IN ('practice', 'mock', 'real', 'recall')) DEFAULT 'practice'
);

CREATE INDEX idx_uqh_user ON user_question_history(user_id);
```

**Step 3: Create RLS policies**

`003_rls_policies.sql`:
```sql
-- Enable RLS on all user-owned tables
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE story ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_round ENABLE ROW LEVEL SECURITY;
ALTER TABLE debrief ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_pattern ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE positioning_statement ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE comp_strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_question_history ENABLE ROW LEVEL SECURITY;

-- Questions are public read
ALTER TABLE question ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions are public" ON question FOR SELECT USING (true);
ALTER TABLE question_company_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Question maps are public" ON question_company_map FOR SELECT USING (true);

-- Standard user-scoped RLS: users can only access their own data
-- Template: repeat for each user-owned table
CREATE POLICY "Users own their profile" ON user_profile FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their stories" ON story FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their workspaces" ON job_workspace FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their rounds" ON interview_round FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their debriefs" ON debrief FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their scores" ON score_entry FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their sessions" ON practice_session FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their drill progress" ON drill_progression FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their strategy" ON coaching_strategy FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their patterns" ON interview_pattern FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their feedback" ON recruiter_feedback FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their outcomes" ON outcome_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their resume" ON resume_analysis FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their positioning" ON positioning_statement FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their linkedin" ON linkedin_analysis FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their comp" ON comp_strategy FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their session logs" ON session_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their story usage" ON story_usage FOR ALL USING (
    EXISTS (SELECT 1 FROM story WHERE story.id = story_usage.story_id AND story.user_id = auth.uid())
);
CREATE POLICY "Users own their question history" ON user_question_history FOR ALL USING (auth.uid() = user_id);

-- Backend service role bypass (for server-side operations)
-- The service_role key bypasses RLS by default in Supabase
```

**Step 4: Create question bank seed script**

`backend/db/seed/questions.py` — Reads `../five-minute-mock-mvp/web/data/behavioral_questions.json` and company overlays, transforms into INSERT statements for the `question` and `question_company_map` tables.

```python
"""
Seed script: Import 253 behavioral questions + company overlays from 5 Minute Mock.

Usage: python -m db.seed.questions
Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
"""
import json
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

SOURCE_DIR = Path(__file__).parent.parent.parent.parent / "five-minute-mock-mvp" / "web" / "data"
QUESTIONS_FILE = SOURCE_DIR / "behavioral_questions.json"
OVERLAYS_DIR = SOURCE_DIR / "technology" / "overlays"


def seed():
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

    # Load questions
    with open(QUESTIONS_FILE) as f:
        data = json.load(f)

    questions = []
    for q in data["questions"]:
        questions.append({
            "id": q["id"],
            "title": q["title"],
            "question_text": q["question"],
            "difficulty": q.get("difficulty", "medium"),
            "category": q.get("category", "behavioral"),
            "theme": q.get("theme"),
            "explanation": q.get("explanation"),
            "tags": json.dumps(q.get("tags", [])),
            "frequency": q.get("frequency", "medium"),
            "time_to_answer_seconds": q.get("time_to_answer_seconds", 180),
            "variations": json.dumps(q.get("variations", [])),
            "follow_up_questions": json.dumps(q.get("follow_up_questions", [])),
            "levels_applicable": q.get("meta", {}).get("levels_applicable", []),
            "roles_applicable": q.get("meta", {}).get("roles_applicable", []),
            "guidance": json.dumps(q.get("question_guidance", {})),
        })

    # Upsert questions in batches of 50
    for i in range(0, len(questions), 50):
        batch = questions[i:i+50]
        client.table("question").upsert(batch).execute()
    print(f"Seeded {len(questions)} questions")

    # Load company overlays
    if OVERLAYS_DIR.exists():
        for overlay_file in OVERLAYS_DIR.glob("*_overlay.json"):
            with open(overlay_file) as f:
                overlay = json.load(f)
            company_key = overlay.get("company_slug", overlay_file.stem.replace("_overlay", ""))
            mappings = []
            for mapping in overlay.get("question_mappings", []):
                mappings.append({
                    "question_id": mapping["canonical_id"],
                    "company_key": company_key,
                    "frequency_at_company": mapping.get("frequency_at_company", "medium"),
                    "typical_round": mapping.get("typical_round"),
                    "company_specific_guidance": json.dumps(mapping.get("company_specific_guidance", {})),
                })
            if mappings:
                client.table("question_company_map").upsert(mappings).execute()
                print(f"Seeded {len(mappings)} mappings for {company_key}")

    print("Done!")


if __name__ == "__main__":
    seed()
```

**Step 5: Apply migrations via Supabase MCP, then seed**

```bash
# Apply each migration via Supabase dashboard SQL editor or MCP
# Then run seed script:
cd backend && python -m db.seed.questions
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: database schema — all tables, RLS, question bank seed"
```

---

## Task 3: FastAPI Skeleton + Config

**Files:**
- Create: `backend/config.py`
- Create: `backend/main.py`
- Create: `backend/api/__init__.py`
- Create: `backend/db/client.py`

**Step 1: Create config**

`backend/config.py`:
```python
from typing import Optional, Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENV: Literal["local", "staging", "production"] = "local"
    DEBUG: bool = True

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    # OpenAI
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o"

    # ElevenLabs
    ELEVENLABS_API_KEY: Optional[str] = None
    ELEVENLABS_AGENT_ID: Optional[str] = None

    # Stripe
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRICE_ID_PREMIUM: Optional[str] = None

    # App
    FRONTEND_URL: str = "http://localhost:5173"


settings = Settings()
```

**Step 2: Create Supabase client**

`backend/db/client.py`:
```python
from supabase import create_client, Client
from backend.config import settings

_client: Client | None = None


def get_supabase() -> Client:
    """Get Supabase client (service role for backend operations)."""
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _client


def get_supabase_for_user(jwt: str) -> Client:
    """Get Supabase client scoped to a user's JWT (respects RLS)."""
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options={"headers": {"Authorization": f"Bearer {jwt}"}}
    )
```

**Step 3: Create FastAPI main app**

`backend/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings

app = FastAPI(title="Five Minute Mock Coach", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.ENV}


# Routers will be added as they're built:
# from backend.api.routers import auth, stories, practice, ...
# app.include_router(auth.router)
```

**Step 4: Verify it runs**

```bash
cd backend
uvicorn backend.main:app --reload --port 8000
# Visit http://localhost:8000/health → {"status": "ok", "env": "local"}
# Visit http://localhost:8000/docs → Swagger UI
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: FastAPI skeleton with config, Supabase client, health check"
```

---

## Task 4: Authentication Middleware

**Files:**
- Create: `backend/api/auth.py`
- Create: `backend/api/routers/auth.py`
- Create: `backend/tests/test_auth.py`

**Port from:** `five-minute-mock-mvp/api/middleware/auth.py`

This task creates:
1. A `get_current_user` FastAPI dependency that validates Supabase JWTs
2. A `POST /api/auth/profile` endpoint to create/update user profiles
3. A workspace count check utility for the free-tier gate (max 1 job workspace for free users)

Key implementation detail: The JWT is decoded using `python-jose` with the `SUPABASE_JWT_SECRET`. The `sub` claim is the user ID.

**Workspace gate logic:**
```python
async def check_workspace_limit(user_id: str, db: Client):
    """Raise 403 if free user tries to create a 2nd job workspace."""
    profile = db.table("user_profile").select("subscription_tier").eq("user_id", user_id).single().execute()
    if profile.data["subscription_tier"] == "free":
        count = db.table("job_workspace").select("id", count="exact").eq("user_id", user_id).execute()
        if count.count >= 1:
            raise HTTPException(403, "Free plan allows 1 job workspace. Upgrade to Premium for unlimited.")
```

**Step N: Commit**

```bash
git commit -m "feat: Supabase JWT auth middleware + profile endpoints + workspace gate"
```

---

## Task 5: React Frontend Skeleton

**Files:**
- Create: `frontend/src/App.tsx` (router setup)
- Create: `frontend/src/layouts/AppLayout.tsx` (sidebar + topbar shell)
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/Topbar.tsx`
- Create: `frontend/src/components/WorkspaceSwitcher.tsx`
- Create: `frontend/src/contexts/WorkspaceContext.tsx`
- Create: `frontend/src/contexts/AuthContext.tsx`
- Create: `frontend/src/lib/api.ts` (axios instance with auth headers)
- Create: `frontend/src/lib/supabase.ts` (Supabase client for auth)

The app shell mirrors the v2 HTML mockup: topbar with workspace selector, adaptive sidebar, main content area. React Router handles page navigation. WorkspaceContext holds the active workspace (general or a specific job ID) and provides it to all child components.

**Auth flow:**
1. `supabase.auth.signInWithOAuth({ provider: 'google' })` or email/password
2. On auth state change, store the JWT
3. All API calls include `Authorization: Bearer <jwt>` via axios interceptor
4. `AuthContext` provides `user`, `loading`, `signIn`, `signOut`

**Step N: Commit**

```bash
git commit -m "feat: React app shell — router, auth context, workspace context, sidebar, topbar"
```

---

## Task 6: Design System + Shared Components

**Files:**
- Create: `frontend/src/styles/design-tokens.css` (CSS custom properties from v2 mockup)
- Create: `frontend/src/components/ui/Card.tsx`
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/Tag.tsx`
- Create: `frontend/src/components/ui/Table.tsx`
- Create: `frontend/src/components/ui/Tabs.tsx`
- Create: `frontend/src/components/ui/Stepper.tsx`
- Create: `frontend/src/components/ui/ScoreChart.tsx` (SVG line chart)
- Create: `frontend/src/components/ui/StrengthBar.tsx`
- Create: `frontend/src/components/ui/ActionBanner.tsx`
- Create: `frontend/src/components/ui/EmptyState.tsx`
- Create: `frontend/src/components/ui/Icons.tsx` (SVG sprite refs)

Extract all CSS custom properties, typography, colors, shadows, and radii from `interview-coach-ui-v2.html` into `design-tokens.css`. Build each shared component as a reusable React component matching the v2 mockup's visual patterns.

**Mobile responsive breakpoints (add to design-tokens.css):**
```css
/* Breakpoints */
@media (max-width: 1024px) { /* tablet: sidebar collapses to icons */ }
@media (max-width: 768px) { /* mobile: sidebar becomes bottom nav or hamburger, cards stack */ }
@media (max-width: 480px) { /* small mobile: single column everything */ }
```

**Step N: Commit**

```bash
git commit -m "feat: design system — tokens, shared UI components, responsive breakpoints"
```

---

## Task 7: AI Coach Service (Backend)

**Files:**
- Create: `backend/api/services/ai_coach.py` (core OpenAI orchestration)
- Create: `backend/api/services/prompt_composer.py` (assembles prompt context per command)
- Create: `backend/api/prompts/` directory with prompt modules
- Copy: Reference files from `references/*.md` → `backend/api/prompts/` as `.txt` files

**Port from:** `five-minute-mock-mvp/api/services/prompt_composer.py` (modular prompt assembly pattern)

This is the brain of the app. The `PromptComposer` assembles system prompts from modular components:

```
BASE COACHING RUBRIC (from rubrics-detailed.md)
+ SENIORITY CALIBRATION (from workspace's seniority band)
+ DIFFERENTIATION MODULE (from differentiation.md)
+ COMMAND-SPECIFIC CONTEXT (from commands/*.md)
+ USER CONTEXT (profile, storybank, score history)
+ WORKSPACE CONTEXT (company, JD, prep data — if in job workspace)
= COMPOSED SYSTEM PROMPT → sent to OpenAI
```

The `AICoachService` wraps OpenAI calls:
```python
class AICoachService:
    async def coach(self, command: str, user_context: dict, message: str) -> str:
        system_prompt = PromptComposer.compose(command, user_context)
        response = await openai_client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": message}],
        )
        return response.choices[0].message.content
```

**Prompt modules to create** (extract from references/):
- `rubrics.txt` — from `rubrics-detailed.md`
- `differentiation.txt` — from `differentiation.md`
- `storybank_guide.txt` — from `storybank-guide.md`
- `calibration.txt` — from `calibration-engine.md`
- `challenge_protocol.txt` — from `challenge-protocol.md`
- `cross_cutting.txt` — from `cross-cutting.md`
- `story_mapping.txt` — from `story-mapping-engine.md`
- `transcript_processing.txt` — from `transcript-processing.md`

**Step N: Commit**

```bash
git commit -m "feat: AI coach service — prompt composer, coaching modules, OpenAI integration"
```

---

## Task 8: Question Bank + Practice API

**Files:**
- Create: `backend/api/routers/questions.py`
- Create: `backend/api/routers/practice.py`
- Create: `backend/api/services/question_service.py`
- Create: `backend/api/services/scoring_engine.py`

**Question Bank Integration:** The 253 seeded questions serve as the content layer. The practice system selects questions based on context:

```python
class QuestionService:
    async def get_questions(self, user_id, workspace_id=None, theme=None, difficulty=None, count=3):
        """
        Select questions based on context:
        - General workspace: filter by theme, difficulty, user's seniority band
        - Job workspace: prioritize company-mapped questions (from question_company_map),
          then fill with questions matching JD competencies
        - Exclude recently practiced (from user_question_history)
        - Weight by frequency (very_high questions appear more often)
        """
```

**Practice API endpoints:**
- `GET /api/questions?theme=leadership&difficulty=hard&count=3` — fetch questions
- `GET /api/questions/random?workspace_id=xxx` — context-aware random question
- `POST /api/practice/start` — start a practice session (returns questions)
- `POST /api/practice/{session_id}/submit` — submit an answer for scoring
- `GET /api/practice/history` — past practice sessions

**Scoring Engine:** Takes a transcript + question + user context, sends to OpenAI with the rubric prompt, returns 5-dimension scores.

```python
class ScoringEngine:
    async def score_answer(self, question: str, answer: str, user_context: dict) -> ScoreResult:
        """Score an answer on 5 dimensions using seniority-calibrated rubric."""
        prompt = PromptComposer.compose("analyze", user_context)
        # ... call OpenAI, parse structured response
        return ScoreResult(substance=4.0, structure=3.5, ...)
```

**Drill progression integration:** The 8 practice stages map to question selection strategy:
- Stage 1 (Ladder): medium difficulty, core themes, 2-minute time constraint
- Stage 2 (Pushback): add follow-up questions from the question data
- Stage 5 (Role): filter by user's target role from `roles_applicable`
- Stage 7 (Stress): hard difficulty, rapid-fire timing

**Step N: Commit**

```bash
git commit -m "feat: question bank API + practice sessions + scoring engine"
```

---

## Task 9: Storybank API

**Files:**
- Create: `backend/api/routers/stories.py`
- Create: `backend/api/services/story_coach.py`

**Endpoints:**
- `GET /api/stories` — list user's stories
- `POST /api/stories` — create a story (guided or direct)
- `PUT /api/stories/{id}` — update a story
- `DELETE /api/stories/{id}` — retire a story (soft delete)
- `POST /api/stories/{id}/improve` — AI-assisted story improvement
- `GET /api/stories/gaps` — identify missing story types based on target roles
- `GET /api/stories/narrative` — narrative identity analysis

**StoryCoachService** uses `storybank-guide.txt` and `differentiation.txt` as prompt context for:
- Guided story discovery ("Tell me about a time at [company from resume]...")
- Earned secret extraction
- Story improvement (before/after)
- Gap analysis against target roles and JD competencies

**Step N: Commit**

```bash
git commit -m "feat: storybank CRUD + AI story coaching + gap analysis"
```

---

## Task 10: Job Workspace + Interview Prep API

**Files:**
- Create: `backend/api/routers/workspaces.py`
- Create: `backend/api/routers/prep.py`
- Create: `backend/api/services/research_service.py`
- Create: `backend/api/services/decode_service.py`
- Create: `backend/api/services/prep_service.py`

**Workspace endpoints (with free-tier gate):**
- `GET /api/workspaces` — list user's job workspaces
- `POST /api/workspaces` — create workspace (**checks workspace limit for free users**)
- `PUT /api/workspaces/{id}` — update workspace
- `DELETE /api/workspaces/{id}` — archive workspace

**Prep endpoints (per workspace):**
- `POST /api/workspaces/{id}/research` — company research + fit assessment
- `POST /api/workspaces/{id}/decode` — JD analysis + competency ranking
- `GET /api/workspaces/{id}/prep` — get/generate prep brief
- `GET /api/workspaces/{id}/concerns` — generate ranked concerns
- `GET /api/workspaces/{id}/questions` — generate interviewer questions
- `POST /api/workspaces/{id}/rounds` — add interview round
- `POST /api/workspaces/{id}/debrief` — post-interview debrief
- `GET /api/workspaces/{id}/hype` — pre-interview confidence plan

**Step N: Commit**

```bash
git commit -m "feat: job workspace CRUD + interview prep (research, decode, concerns, hype)"
```

---

## Task 11: Scoring + Progress API

**Files:**
- Create: `backend/api/routers/progress.py`
- Create: `backend/api/services/progress_analyzer.py`
- Create: `backend/api/services/calibration_engine.py`
- Create: `backend/api/services/pattern_detection.py`

**Endpoints:**
- `GET /api/progress` — full progress report (trends, calibration, patterns)
- `GET /api/progress/scores?workspace_id=xxx` — score history (filterable)
- `GET /api/progress/patterns` — effective/ineffective patterns
- `GET /api/progress/calibration` — self-assessment accuracy
- `POST /api/feedback` — capture recruiter feedback, outcomes, corrections

**PatternDetectionService** runs after each scored session:
- Checks for recurring patterns across 3+ sessions
- Identifies story effectiveness (which stories score well where)
- Updates `interview_pattern` table

**CalibrationEngine** (from `calibration-engine.md`):
- Compares self-scores vs coach scores → over/under/accurate
- Detects scoring drift when outcomes contradict coach scores
- Identifies cross-dimension root causes

**Step N: Commit**

```bash
git commit -m "feat: progress analytics — scoring trends, pattern detection, calibration engine"
```

---

## Task 12: Materials API

**Files:**
- Create: `backend/api/routers/materials.py`
- Create: `backend/api/services/resume_service.py`
- Create: `backend/api/services/pitch_service.py`

**Endpoints:**
- `POST /api/materials/resume/upload` — upload resume (Supabase Storage) + AI analysis
- `GET /api/materials/resume` — get resume analysis
- `POST /api/materials/resume/optimize` — AI optimization suggestions
- `GET /api/materials/pitch` — get positioning statement
- `POST /api/materials/pitch/generate` — AI-generated pitch
- `GET /api/materials/linkedin` — get LinkedIn analysis
- `POST /api/materials/linkedin/audit` — AI LinkedIn audit
- `GET /api/materials/salary` — get comp strategy
- `POST /api/materials/salary/build` — AI comp strategy

**Step N: Commit**

```bash
git commit -m "feat: materials API — resume, pitch, LinkedIn, salary coaching"
```

---

## Tasks 13-19: Frontend Pages

Each frontend page task creates the React page component(s) and hooks to wire up to the backend API. The visual design is already defined in `interview-coach-ui-v2.html` — these tasks convert that HTML/CSS into React components using the design system from Task 6.

### Task 13: Dashboard Pages
- `frontend/src/pages/DashboardGeneral.tsx` — profile card, storybank summary, score chart, kanban, stepper, action banner
- `frontend/src/pages/DashboardJob.tsx` — job header, prep checklist, round timeline, filtered scores
- `frontend/src/hooks/useDashboard.ts` — data fetching

### Task 14: Storybank Page
- `frontend/src/pages/Storybank.tsx` — story table, add/improve flows, gap analysis, narrative identity
- `frontend/src/components/StoryForm.tsx` — add/edit form with STAR fields
- `frontend/src/hooks/useStories.ts`

### Task 15: Practice Page + Voice
- `frontend/src/pages/Practice.tsx` — drill stepper, voice interface, question display, timer
- `frontend/src/components/VoiceRecorder.tsx` — MediaRecorder API for capturing audio
- `frontend/src/components/Scorecard.tsx` — post-practice 5-dimension feedback
- `frontend/src/hooks/usePractice.ts`

### Task 16: Mock Interview Page
- `frontend/src/pages/MockInterview.tsx` — format selector, full interview flow
- `frontend/src/components/MockSession.tsx` — voice interview UI (4-6 questions, timer, interviewer voice)
- `frontend/src/hooks/useMock.ts`

### Task 17: Interview Prep Page (Job workspace)
- `frontend/src/pages/InterviewPrep.tsx` — tabbed view (Research, Decode, Brief, Concerns, Questions, Present)
- One sub-component per tab
- `frontend/src/hooks/usePrep.ts`

### Task 18: Progress Page
- `frontend/src/pages/Progress.tsx` — score chart (SVG), calibration display, pattern cards
- `frontend/src/components/ScoreTrendChart.tsx` — interactive SVG chart with workspace filtering
- `frontend/src/hooks/useProgress.ts`

### Task 19: Materials Page
- `frontend/src/pages/Materials.tsx` — tabbed view (Resume, LinkedIn, Pitch, Outreach, Salary)
- `frontend/src/components/ResumeUpload.tsx` — file upload to Supabase Storage
- `frontend/src/hooks/useMaterials.ts`

**Each task commits independently:**

```bash
git commit -m "feat: [page name] page — components, hooks, API integration"
```

---

## Task 20: ElevenLabs Voice Integration

**Files:**
- Create: `backend/api/routers/voice.py`
- Create: `backend/api/services/voice_service.py`
- Modify: `frontend/src/components/MockSession.tsx` (add ElevenLabs WebSocket)

**Port from:** `five-minute-mock-mvp/api/services/elevenlabs.py`

**Backend:**
- `GET /api/voice/signed-url` — get ElevenLabs ConvAI signed URL
- The ElevenLabs agent is configured with the coaching methodology as its system prompt
- Agent speaks interview questions with a realistic voice
- Agent handles follow-up questions and pushback

**Frontend:**
- MockSession component connects to ElevenLabs WebSocket via signed URL
- Browser captures audio via MediaRecorder API
- Audio streams to ElevenLabs for real-time conversation
- When session ends, transcript is captured and sent to scoring engine

**Step N: Commit**

```bash
git commit -m "feat: ElevenLabs voice integration — signed URL, WebSocket, mock interview flow"
```

---

## Task 21: Stripe Integration

**Files:**
- Create: `backend/api/routers/billing.py`
- Create: `backend/api/services/stripe_service.py`
- Create: `frontend/src/pages/Pricing.tsx`
- Create: `frontend/src/components/UpgradeModal.tsx`

**Stripe setup:**
1. Create a product "Five Minute Mock Coach Premium" in Stripe Dashboard
2. Create a price (monthly or annual subscription)
3. Store `STRIPE_PRICE_ID_PREMIUM` in `.env`

**Backend endpoints:**
- `POST /api/billing/checkout` — create Stripe Checkout Session, return URL
- `POST /api/billing/portal` — create Stripe Customer Portal session (manage subscription)
- `POST /api/billing/webhook` — handle Stripe webhooks:
  - `checkout.session.completed` → upgrade user to premium (`subscription_tier = 'premium'`)
  - `customer.subscription.deleted` → downgrade to free
  - `customer.subscription.updated` → handle plan changes
  - `invoice.payment_failed` → flag account

**Frontend:**
- `UpgradeModal` appears when a free user tries to create a 2nd workspace
- Shows pricing, "Upgrade to Premium" button → redirects to Stripe Checkout
- After success, Stripe redirects back to app with `?session_id=...`
- App verifies and refreshes user profile

**Workspace gate (enforced in backend):**
```python
# In POST /api/workspaces
async def create_workspace(workspace: WorkspaceCreate, user: AuthUser):
    await check_workspace_limit(user.id, db)  # raises 403 for free users with 1+ workspace
    # ... create workspace
```

**Step N: Commit**

```bash
git commit -m "feat: Stripe integration — checkout, webhooks, premium gate, upgrade modal"
```

---

## Task 22: Mobile Responsive Design

**Files:**
- Modify: `frontend/src/styles/design-tokens.css` (responsive breakpoints)
- Modify: `frontend/src/layouts/AppLayout.tsx` (collapsible sidebar)
- Create: `frontend/src/components/MobileNav.tsx` (bottom navigation for mobile)
- Modify: All page components (stack grids on mobile)

**Breakpoint strategy:**
- `>1024px`: Full sidebar + content (desktop — current design)
- `768-1024px`: Collapsed icon sidebar (40px) + content. Sidebar expands on hover.
- `<768px`: No sidebar. Bottom tab navigation (5 tabs: Dashboard, Stories, Practice, Prep, More). Topbar simplifies to logo + avatar.
- `<480px`: Single-column cards, full-width everything.

**Key mobile adaptations:**
- Workspace switcher becomes a full-screen sheet on mobile
- Score charts resize with viewBox (already responsive SVG)
- Data tables become card lists on mobile
- Voice interface gets larger touch targets (mic button 100px on mobile)
- Kanban board stacks vertically

**Step N: Commit**

```bash
git commit -m "feat: mobile responsive — collapsible sidebar, bottom nav, stacked layouts"
```

---

## Task 23: Railway Deployment

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile` (or static build config)
- Create: `railway.toml` (or configure via Railway dashboard)
- Modify: `backend/config.py` (production settings)

**Backend Dockerfile:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "$PORT"]
```

**Frontend:** Build with `npm run build`, deploy the `dist/` folder as a static site on Railway (or serve via the backend with `StaticFiles`).

**Railway setup:**
1. Create a project "five-minute-mock-coach"
2. Add backend service (Docker, from `backend/` directory)
3. Add frontend service (static site, from `frontend/dist/`)
4. Set environment variables from `.env.example`
5. Generate domains for both services
6. Update CORS to allow the frontend domain

**Step N: Commit**

```bash
git commit -m "feat: Railway deployment — Dockerfiles, production config"
```

---

## Question Bank Integration Summary

The existing 253 behavioral questions from 5 Minute Mock integrate as follows:

| Feature | How Questions Are Used |
|---|---|
| **General Practice** | Questions filtered by theme, difficulty, user's level. Drill stage adds constraints (time, pushback, format). |
| **Job Workspace Practice** | Questions filtered by company overlay (Google overlay prioritizes BQ-021, BQ-045, etc. with company-specific guidance). Falls back to JD competency matching. |
| **Mock Interview** | 4-6 questions selected by format. Behavioral Screen uses medium-frequency questions. Bar Raiser uses hard + follow-ups. |
| **Interview Prep — Predicted Questions** | Company overlay + JD competency ranking → "Google will likely ask about leadership (BQ-021, BQ-045) and technical decision-making (BQ-112)." |
| **Storybank Gap Analysis** | Cross-reference question themes the user hasn't practiced with their storybank. "You have no story for conflict resolution, but 19 questions test this theme." |
| **Progress — Question Type Performance** | Track scores per theme from `user_question_history`. "Your leadership scores average 4.2, but innovation scores are 2.8." |

This is a natural fit — the question bank provides content, the coaching methodology provides intelligence.

---

## Execution Parallelization Plan

These tasks can run in parallel groups:

**Wave 1 — Foundation (Tasks 1-6):**
- Agent A: Tasks 1-4 (backend: repo setup → Supabase → FastAPI → auth)
- Agent B: Tasks 5-6 (frontend: React skeleton → design system)

**Wave 2 — Core APIs + Pages (Tasks 7-19):**
- Agent C: Tasks 7-9 (AI coach service, question bank + practice, storybank)
- Agent D: Tasks 10-12 (job workspaces, scoring + progress, materials)
- Agent E: Tasks 13-16 (dashboard, storybank, practice, mock pages)
- Agent F: Tasks 17-19 (interview prep, progress, materials pages)

**Wave 3 — Integrations (Tasks 20-23):**
- Agent G: Task 20 (ElevenLabs voice)
- Agent H: Task 21 (Stripe)
- Agent I: Task 22 (mobile responsive)
- Agent J: Task 23 (Railway deployment)

---

## Post-MVP Enhancements (Not in this plan)

- Admin dashboard
- Email notifications (interview reminders, debrief prompts)
- Transcript upload + analysis (from Otter, Zoom, etc.)
- Community question board
- Referral / invite system
- Advanced analytics (outcome correlation, targeting insights)
- Thank-you note generator
- Negotiation coaching post-offer
