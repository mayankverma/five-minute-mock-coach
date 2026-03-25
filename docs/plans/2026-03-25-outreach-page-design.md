# Outreach Page Design

> Validated through brainstorming session on 2026-03-25.

---

## Overview

Rebuild the Outreach page from a placeholder into a chat-first outreach coaching tool. Users select a message type, chat with the AI coach to draft personalized messages, and all conversations are saved for future reference.

Based on the interview-coach-skill's `outreach` command — 9 message types, quality rubric, follow-up sequences, platform-specific mechanics.

---

## Page States

### State 1 — Conversation List (default)

```
┌──────────────────────────────────────────────────────────────┐
│  Outreach                                    [+ New Chat]    │
│  Craft personalized networking messages with your AI coach.  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Title                  │ Type              │ Date │ ⋯  │  │
│  │────────────────────────│───────────────────│──────│─────│  │
│  │ Cold LinkedIn — 3/25   │ Cold LinkedIn     │ 3/25 │ ⋯  │  │
│  │ Recruiter reply — 3/24 │ Recruiter Reply   │ 3/24 │ ⋯  │  │
│  │ Warm intro via Sam     │ Warm Intro        │ 3/23 │ ⋯  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Empty state when no conversations:                          │
│  "No outreach conversations yet."                            │
│  [+ Start your first outreach]                               │
└──────────────────────────────────────────────────────────────┘
```

- Table with columns: Title, Type, Date, Actions (⋯)
- Actions menu: Rename, Delete
- Click row → opens that conversation (State 3)
- "+ New Chat" → shows type selector (State 2)

### State 2 — Message Type Selector

Inline grid (same as current) showing 8 message types:
1. Cold LinkedIn Connection (300 chars)
2. Cold Email (75-125 words)
3. Warm Intro Request (Forwardable blurb)
4. Informational Interview Ask
5. Recruiter Reply
6. Follow-Up
7. Post-Meeting Follow-Up
8. Referral Request

Clicking one creates a conversation via API and navigates to State 3.

### State 3 — Chat View (full width)

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back to Outreach  /  Cold LinkedIn — 3/25                │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  Coach: You're drafting a cold LinkedIn connection     │  │
│  │  request (300 chars max). Who are you reaching out     │  │
│  │  to? Give me their name, role, and company.            │  │
│  │                                                        │  │
│  │  Suggestion pills:                                     │  │
│  │  [Draft for a hiring manager at target company]        │  │
│  │  [I have a mutual connection] [Help me find the hook]  │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ Type message...                            [>]   │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

- Full-width chat (no split pane — outreach is pure conversation)
- Breadcrumb header: "← Back to Outreach / [conversation title]"
- Markdown rendering for coach responses
- Suggestion pills specific to each message type
- Messages persist to DB after each exchange

---

## Suggestion Pills by Message Type

| Type | Pills |
|------|-------|
| Cold LinkedIn | "Draft for a hiring manager", "I have a mutual connection", "Help me find the right hook" |
| Cold Email | "Write a cold email to a VP", "Help with subject line", "Review my draft" |
| Warm Intro | "Ask a former colleague for intro", "Write a forwardable blurb" |
| Informational | "Ask someone in my target role", "Prepare questions for the call" |
| Recruiter Reply | "A recruiter reached out — help me respond", "How to ask about comp range" |
| Follow-Up | "Follow up on unanswered message", "Add value in my follow-up" |
| Post-Meeting | "Write a thank-you after coffee chat", "Follow up after informational" |
| Referral | "Ask for a referral at target company", "Write materials for my referrer" |

---

## Data Model

```sql
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
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/outreach/conversations | Create new conversation |
| GET | /api/outreach/conversations | List all (metadata only) |
| GET | /api/outreach/conversations/:id | Get with full messages |
| PUT | /api/outreach/conversations/:id | Rename |
| DELETE | /api/outreach/conversations/:id | Delete |
| POST | /api/outreach/conversations/:id/chat | SSE streaming chat |

---

## AI Prompt Context

The outreach chat prompt includes:
- Message type framework from interview-coach-skill (character limits, key principles, message structure)
- User's positioning statement (if exists) for hooks
- Resume analysis positioning strengths (fallback)
- Storybank earned secrets for credibility hooks
- Message quality rubric (Specificity, Brevity, Ask Clarity, Value Signal, Authenticity)
- Follow-up strategy guidance

---

## Implementation Sequence

1. DB migration for outreach_conversation table
2. Backend: outreach router with CRUD + SSE chat endpoint + outreach_chat prompt
3. Frontend: useOutreachChat hook
4. Frontend: OutreachPage rebuild (list view + type selector + chat view)
