-- Migration 006: Cache story gap analysis results
-- Gaps are AI-generated and expensive — cache them instead of computing on every page load

CREATE TABLE story_gap_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES job_workspace(id) ON DELETE CASCADE,
    mode TEXT NOT NULL DEFAULT 'universal',
    coverage_score INT,
    gaps JSONB DEFAULT '[]',
    mapped_stories JSONB DEFAULT '[]',
    concentration_risk JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One cached analysis per user per workspace (null workspace = general prep)
CREATE UNIQUE INDEX story_gap_analysis_user_ws ON story_gap_analysis (user_id) WHERE workspace_id IS NULL;
CREATE UNIQUE INDEX story_gap_analysis_user_ws_job ON story_gap_analysis (user_id, workspace_id) WHERE workspace_id IS NOT NULL;

ALTER TABLE story_gap_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their gap analysis" ON story_gap_analysis FOR ALL USING (auth.uid() = user_id);
