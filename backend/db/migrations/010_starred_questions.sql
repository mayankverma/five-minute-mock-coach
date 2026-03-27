-- 010_starred_questions.sql
-- Starred questions for practice question browser

CREATE TABLE IF NOT EXISTS user_starred_question (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'bank',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_starred_user ON user_starred_question(user_id);

ALTER TABLE user_starred_question ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'starred_user' AND tablename = 'user_starred_question') THEN
    CREATE POLICY starred_user ON user_starred_question FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;
