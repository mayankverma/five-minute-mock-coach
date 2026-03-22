-- Migration 002: Question bank schema

CREATE TABLE question (
    id TEXT PRIMARY KEY,
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
    guidance JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_question_theme ON question(theme);
CREATE INDEX idx_question_difficulty ON question(difficulty);

CREATE TABLE question_company_map (
    question_id TEXT REFERENCES question(id) ON DELETE CASCADE,
    company_key TEXT NOT NULL,
    frequency_at_company TEXT DEFAULT 'medium',
    typical_round TEXT,
    company_specific_guidance JSONB,
    PRIMARY KEY (question_id, company_key)
);

CREATE INDEX idx_qcm_company ON question_company_map(company_key);

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
