# Story Version History with Conversation-Linked Versions

## Overview

Save coaching conversations per story so users can resume unfinished sessions, auto-create version snapshots when the AI extracts an improved story, and browse how their story evolved over time.

## Current State

- Story records persist in Supabase `story` table (STAR fields, skills, strength, etc.)
- Chat conversations are entirely ephemeral — React state only, lost on navigation or refresh
- No conversation or version tables exist
- The AI already auto-extracts stories via `|||STORY_EXTRACT|||` blocks hidden from the user
- Editing an existing story currently creates a new row (bug: calls POST not PUT)

## Desired End State

Every coaching session is persisted. When the AI has enough information, it auto-saves an improved version with a change summary. Users can resume unfinished conversations, browse past versions from a dropdown, and see how their story evolved. The coach uses encouraging, dynamic transition messages before extraction.

### Verification:
- User can close browser mid-conversation, return later, and resume where they left off
- Each AI extraction creates a version snapshot with an AI-generated change summary
- Version dropdown in Story Card shows all past versions with summaries
- Selecting an old version shows read-only snapshot of that version's fields
- Storybank accordion shows latest version info

## What We're NOT Doing

- Side-by-side diff view between two versions
- Branching / forking (versions are linear)
- Replaying old conversation transcripts in the chat panel
- Exporting version history
- Conversation search

## Data Model

### Table: `story_conversation`

```sql
CREATE TABLE story_conversation (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id    UUID REFERENCES story(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  messages    JSONB NOT NULL DEFAULT '[]',
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
```

- `story_id` is **nullable** for brand new stories (no story record yet). Gets linked after first extraction creates the story row.
- `messages` stores the full conversation array: `[{"role": "coach", "text": "..."}, {"role": "user", "text": "..."}]`
- Only one `active` session per story at a time (partial unique index).
- An `active` session keeps getting appended to across multiple visits until it produces a version or is abandoned.

### Session Lifecycle

```
States:
  active    -> conversation ongoing, no version produced yet
  completed -> conversation produced a version (AI extracted or user saved)
  abandoned -> user explicitly discarded without saving

Transitions:
  active -> completed  : AI emits STORY_EXTRACT, or user manually saves during idle
  active -> abandoned  : user explicitly discards
  completed -> (none)  : terminal state
  abandoned -> (none)  : terminal state
```

### Table: `story_version`

```sql
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
```

- `fields` is a full snapshot of all STAR fields at that point in time.
- `change_summary` is AI-generated, e.g. "Strengthened Result with concrete adoption metrics".
- `version_num` is auto-incremented per story (computed as max+1 on insert).
- `session_id` is NULL for manual edits or the initial creation.
- v1 is always the initial story creation.

### RLS Policies

```sql
-- story_conversation: users can only access their own
ALTER TABLE story_conversation ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_conversation_user ON story_conversation
  FOR ALL USING (user_id = auth.uid());

-- story_version: access through story ownership
ALTER TABLE story_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_version_user ON story_version
  FOR ALL USING (story_id IN (SELECT id FROM story WHERE user_id = auth.uid()));
```

## API Changes

### New Endpoints

```
GET  /api/stories/{story_id}/conversations
     Returns all sessions for a story, ordered by created_at desc.
     Response: { conversations: [...] }

GET  /api/stories/{story_id}/conversations/active
     Returns the active session if one exists, or 404.
     Response: { id, messages, status, created_at, updated_at }

POST /api/stories/{story_id}/conversations
     Creates a new active session. Fails if an active session already exists.
     Response: { id, messages: [], status: "active" }

PUT  /api/stories/conversations/{session_id}/abandon
     Marks session as "abandoned".
     Response: { status: "abandoned" }

GET  /api/stories/{story_id}/versions
     Returns all versions for a story, ordered by version_num desc.
     Response: { versions: [{ version_num, fields, change_summary, created_at, session_id }] }

GET  /api/stories/{story_id}/versions/{version_num}
     Returns a specific version's field snapshot.
     Response: { version_num, fields, change_summary, created_at }
```

### Modified Endpoint: `POST /api/stories/chat`

Request body adds optional `session_id`:

```json
{
  "messages": [...],
  "session_id": "uuid-or-null"
}
```

After streaming completes:
1. If `session_id` is provided, UPDATE the session's `messages` JSONB with the full conversation array and set `updated_at = NOW()`.
2. If `|||STORY_EXTRACT|||` is detected:
   a. Parse the extraction JSON (now includes `changeSummary` field).
   b. UPDATE the `story` record with new field values (fix: use PUT logic, not POST).
   c. INSERT a `story_version` row with the snapshot and AI-generated `change_summary`.
   d. UPDATE the session to `status = 'completed'`.
   e. For new stories (session has `story_id = NULL`): INSERT the story row first, then link `story_conversation.story_id`.

All steps in a single transaction.

### Modified Endpoint: `POST /api/stories` (create)

After inserting the story, also create `story_version` v1 with the initial fields and `change_summary = "Initial draft"`.

### Modified Endpoint: Manual Save (existing Save Story button)

When the user manually saves during an idle chat:
1. UPDATE the `story` record.
2. INSERT a `story_version` with `change_summary = "Manual update"`.
3. Mark the active session as `completed`.

## Prompt Changes

### Updated `story_chat.txt` — Extraction Block

Add `changeSummary` to the extraction JSON format:

```
|||STORY_EXTRACT|||
{
  "title": "...",
  "situation": "...",
  "task": "...",
  "action": "...",
  "result": "...",
  "primarySkill": "...",
  "secondarySkill": "...",
  "earnedSecret": "...",
  "strength": 4,
  "domain": "...",
  "deployFor": "...",
  "changeSummary": "One-line summary of what improved in this version"
}
|||END_EXTRACT|||
```

### Updated Transition Message

Replace the current "I have everything I need to build your story" instruction with:

> Before emitting the extraction block, write an encouraging transition message that acknowledges the quality of what the user shared. Vary the message naturally each time. Examples: "This is a powerful story. Let me extract the gold from it...", "You've got real depth here. Distilling the key elements now...", "That's a story interviewers will remember. Pulling out the nuggets...". Be genuine and reference something specific from the conversation.

### Updated Improvement Instructions

For existing stories, add `changeSummary` context:

> When you emit a STORY_EXTRACT for an improved story, the changeSummary should describe what you improved relative to the previous version. Be specific: "Replaced vague Result with three concrete metrics" is better than "Improved the Result section".

## Frontend Changes

### `useStoryChat` Hook — Session-Aware

```typescript
export function useStoryChat(
  openingMessages: ChatMessage[],
  storyContext?: string,
  storyId?: string,          // NEW
): UseStoryChatReturn {
```

On initialization:
1. If `storyId` provided, call `GET /api/stories/{storyId}/conversations/active`
2. If active session exists: load its `messages` into state, store `sessionId`
3. If no active session: call `POST /api/stories/{storyId}/conversations`, use opening messages, store `sessionId`
4. If no `storyId` (new story): create a conversation with `story_id = NULL`

On `sendMessage`:
- Include `session_id` in the `POST /api/stories/chat` request body
- Backend handles persisting messages after each exchange

On `story_complete` SSE event:
- Populate story card as today
- Backend has already created the version and marked session completed
- Trigger refetch of story data

### New: `useStoryVersions` Hook

```typescript
interface StoryVersion {
  versionNum: number;
  fields: Record<string, unknown>;
  changeSummary: string | null;
  createdAt: string;
  sessionId: string | null;
}

export function useStoryVersions(storyId: string) {
  // GET /api/stories/{storyId}/versions
  // Returns { versions, isLoading }
}
```

### StoryBuilder Component Changes

**On mount:**
- Check for active session via the hook (handled in useStoryChat)
- If resuming: show banner "Resuming your previous session" with a dismiss/abandon option

**Save Story button behavior:**
- Chat flow active (isStreaming or active session with messages) -> button disabled, tooltip "Coach will save when ready"
- Chat idle / no active session -> button enabled for manual field edits
- On manual save: creates version with "Manual update" summary, completes session

**Version dropdown in Story Card header:**

```
┌─────────────────────────────────┐
│ Story Card        v3 (latest) v │
├─────────────────────────────────┤
│ Progress bar: 7/7 fields        │
│ ...fields...                    │
```

Clicking the dropdown shows all versions with change summaries. Selecting an old version:
- Card fields show that version's snapshot (read-only, dimmed)
- Banner: "Viewing v2 -- Mar 21. This is a past version." + "Back to current" button
- Chat panel stays on current conversation
- Save button hidden while viewing old version

### Storybank Accordion Addition

In the expanded accordion row, below the title row:

```
v3 · Last improved Mar 23 · "Added adoption metrics"
```

Subtle metadata line showing latest version activity.

## Implementation Phases

### Phase 1: Database + API Foundation

**Files:**
- Create: `backend/db/migrations/004_story_versions.sql`
- Modify: `backend/api/routers/stories.py` (new endpoints + modify chat)
- Modify: `backend/api/services/ai_coach.py` (no changes needed)

**Work:**
1. Write migration SQL (tables, indexes, RLS policies)
2. Run migration in Supabase SQL Editor
3. Add conversation CRUD endpoints
4. Add version CRUD endpoints
5. Modify `/api/stories/chat` to accept `session_id` and persist messages
6. Modify `/api/stories/chat` to auto-create version on extraction
7. Fix existing story update to use PUT not POST
8. Create v1 version on initial story creation

**Success Criteria:**
- Automated: `curl` tests for new endpoints return correct responses
- Automated: sending a chat with `session_id` persists messages to DB
- Manual: complete a story conversation, verify version row created in Supabase

### Phase 2: Prompt Updates

**Files:**
- Modify: `backend/api/prompts/story_chat.txt`

**Work:**
1. Add `changeSummary` to the extraction JSON format
2. Update transition message instructions (encouraging, dynamic)
3. Add guidance for improvement-mode change summaries

**Success Criteria:**
- Manual: chat through a story improvement, verify coach uses encouraging transition and extraction includes `changeSummary`

### Phase 3: Frontend Session Management

**Files:**
- Modify: `frontend/src/hooks/useStoryChat.ts` (session-aware)
- Modify: `frontend/src/components/StoryBuilder.tsx` (resume banner, save button logic)
- Modify: `frontend/src/pages/Storybank.tsx` (pass storyId to builder)

**Work:**
1. Update `useStoryChat` to check for active session on mount
2. Load existing messages when resuming
3. Pass `session_id` in chat requests
4. Add "Resuming previous session" banner with abandon option
5. Disable Save button during active chat flow
6. Handle story_complete event (refetch story data)

**Success Criteria:**
- Automated: Playwright test — start conversation, navigate away, return, verify conversation resumes
- Manual: complete a full improvement flow, verify version created without manual save

### Phase 4: Version History UI

**Files:**
- Create: `frontend/src/hooks/useStoryVersions.ts`
- Modify: `frontend/src/components/StoryBuilder.tsx` (version dropdown in card header)
- Modify: `frontend/src/components/story-builder.css` (dropdown styles)
- Modify: `frontend/src/pages/Storybank.tsx` (version info in accordion)

**Work:**
1. Create `useStoryVersions` hook
2. Add version dropdown to Story Card header
3. Implement old version viewing (read-only snapshot, banner, back button)
4. Add version metadata line to Storybank accordion

**Success Criteria:**
- Automated: Playwright test — create story, improve it, verify dropdown shows 2 versions
- Manual: browse versions, verify old version shows correct field snapshot
- Manual: verify "Back to current" returns to latest version

## Testing Strategy

### Unit Tests
- Version number auto-increment logic
- Session state transitions (active -> completed, active -> abandoned)
- Partial unique index enforcement (cannot create two active sessions)

### Integration Tests
- Full flow: create story -> chat -> extraction -> version created -> new session
- Resume flow: start chat -> close -> reopen -> messages loaded
- Manual save flow: edit fields -> save -> version created -> session completed

### Playwright E2E
- New story creation produces v1
- Improve with Coach resumes active session
- AI extraction auto-saves and creates version
- Version dropdown navigates between versions
- Abandoned session starts fresh next time

## Migration Notes

- Existing stories get no version history (no backfill needed — versions start from next save)
- No data migration required for existing story rows
- Migration SQL is additive only (new tables, no column changes to `story`)
