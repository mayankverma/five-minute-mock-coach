-- Migration 001: Core schema for Five Minute Mock Coach
-- Run via Supabase SQL Editor or MCP

-- ============================================================
-- USER PROFILE
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
-- JOB WORKSPACE
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
-- INTERVIEW ROUNDS
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
-- DEBRIEF
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
-- SESSION + STORY TRACKING
-- ============================================================
CREATE TABLE session_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    commands_run TEXT[] DEFAULT '{}',
    key_outcomes TEXT,
    coaching_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE story_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES story(id) ON DELETE CASCADE NOT NULL,
    session_id UUID REFERENCES practice_session(id) ON DELETE CASCADE,
    round_id UUID REFERENCES interview_round(id) ON DELETE CASCADE,
    context TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
