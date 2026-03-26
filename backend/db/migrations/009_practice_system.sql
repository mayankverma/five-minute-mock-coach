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
