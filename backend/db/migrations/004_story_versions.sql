-- Run via Supabase SQL Editor or MCP
-- Story conversation sessions and version snapshots

-- Story conversation sessions (coaching chat history)
CREATE TABLE story_conversation (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id    UUID REFERENCES story(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  messages    JSONB NOT NULL DEFAULT '[]'::jsonb,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_story_conversation_story ON story_conversation(story_id);
CREATE INDEX idx_story_conversation_user ON story_conversation(user_id);

-- Safety net: at most one active session per story
CREATE UNIQUE INDEX idx_one_active_session
  ON story_conversation(story_id)
  WHERE status = 'active';

-- Story version snapshots
CREATE TABLE story_version (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id        UUID REFERENCES story(id) ON DELETE CASCADE NOT NULL,
  session_id      UUID REFERENCES story_conversation(id) ON DELETE SET NULL,
  version_num     INTEGER NOT NULL,
  fields          JSONB NOT NULL,
  change_summary  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_story_version_story ON story_version(story_id);

-- RLS policies
ALTER TABLE story_conversation ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_conversation_user ON story_conversation
  FOR ALL USING (user_id = auth.uid());

ALTER TABLE story_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_version_user ON story_version
  FOR ALL USING (story_id IN (SELECT id FROM story WHERE user_id = auth.uid()));
