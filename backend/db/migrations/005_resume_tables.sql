-- Migration 005: Resume builder tables
-- Adds resume, resume_section, resume_analysis_v2, resume_coach_session, resume_coach_message

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
