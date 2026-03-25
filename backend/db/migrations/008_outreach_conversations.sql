-- Outreach conversations with message history
CREATE TABLE outreach_conversation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message_type TEXT NOT NULL,
    messages JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX outreach_conversation_user_idx ON outreach_conversation (user_id);

ALTER TABLE outreach_conversation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their outreach" ON outreach_conversation
    FOR ALL USING (auth.uid() = user_id);
