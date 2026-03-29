# Story Builder — Streaming Chat + Voice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the dummy AI in StoryBuilder with real streaming conversations that guide users through story discovery, then populate the STAR form for review when the AI has gathered enough.

**Architecture:** SSE streaming from FastAPI to React. The backend streams OpenAI responses token-by-token. The system prompt instructs the AI to signal when it has a complete story by including a structured JSON extraction block (delimited by `|||STORY_EXTRACT|||`). The backend strips this from the visible stream and emits it as a separate `story_complete` SSE event. The frontend accumulates tokens into the chat, and when `story_complete` arrives, expands the story card and populates all fields at once for user review.

**Tech Stack:** FastAPI `StreamingResponse` (SSE), OpenAI `stream=True`, React `fetch` + `ReadableStream`, ElevenLabs ConvAI WebSocket (voice mode), existing Supabase auth.

---

## Task 1: Register story_chat command in PromptComposer

**Files:**
- Modify: `backend/api/services/prompt_composer.py` (line ~23, `COMMAND_MODULES` dict)

**Step 1: Add the command mapping**

In `COMMAND_MODULES`, add:

```python
"story_chat": ["storybank_guide", "differentiation"],
```

**Step 2: Verify prompt files exist**

Run: `ls backend/api/prompts/storybank_guide.txt backend/api/prompts/differentiation.txt`
Expected: Both files listed.

**Step 3: Commit**

```bash
git add backend/api/services/prompt_composer.py
git commit -m "feat: register story_chat command in prompt composer"
```

---

## Task 2: Create story conversation system prompt

**Files:**
- Create: `backend/api/prompts/story_chat.txt`

**Step 1: Write the conversation prompt**

```text
## Story Discovery Conversation

You are having a natural conversation to help the candidate surface and structure a great interview story. Your goal is to guide them from raw experience to a complete STAR story with an earned secret.

### Conversation Flow

1. **Open with ONE reflective prompt** (do not show a list of options):
   - Peak experiences: "When have you been at your best at work?"
   - Challenge/growth: "What's the hardest situation you've navigated professionally?"
   - Impact/influence: "When have you made something significant happen?"
   - Failure/learning: "What's a decision you'd make differently?"

2. **Listen for the story embedded in their answer.** When you hear one, acknowledge it: "That's a compelling story. Let's capture it."

3. **Walk through STAR naturally** — one question at a time, not a checklist:
   - Situation: Get 2-3 sentences of context (when, where, what was happening)
   - Task: What was YOUR specific responsibility? (not the team's)
   - Action: What did YOU specifically do? (decisions, steps, trade-offs)
   - Result: What happened? Push for numbers (revenue, time, team size, %)

4. **Extract the earned secret** using reflection questions:
   - "What did you believe before this that turned out to be wrong?"
   - "What would surprise someone who hasn't done this?"
   - "What do most people get wrong about this kind of situation?"

5. **When you have a complete story** (Situation + Task + Action + Result, ideally with an earned secret), say something like: "I have everything I need to build your story. Let me put it together for you." Then include the extracted story in this exact format at the END of your message:

|||STORY_EXTRACT|||
{
  "title": "Short memorable title (5-8 words)",
  "situation": "2-3 sentences of context",
  "task": "1-2 sentences of specific responsibility",
  "action": "3-5 sentences of what YOU did",
  "result": "2-3 sentences with metrics where possible",
  "primarySkill": "One primary competency tag",
  "secondarySkill": "One secondary competency tag",
  "earnedSecret": "1-2 sentence counterintuitive insight",
  "strength": 3,
  "domain": "Industry/domain if mentioned",
  "deployFor": "What interview question type this story answers"
}
|||END_EXTRACT|||

The user will NOT see the extraction block — it is parsed by the system.

### Rules
- ONE question per message. Never ask multiple questions.
- Keep responses concise (2-4 sentences max before asking).
- Do NOT mention STAR format, frameworks, or structure. Just ask naturally.
- Do NOT fill in details the candidate didn't provide. If something is missing, ask.
- Rate strength conservatively: 3 = solid but generic, 4 = strong with evidence, 5 = unique and quantified.
- If the candidate gives a vague answer, push for specifics: "Can you walk me through exactly what you did?"
- If the candidate mentions numbers, always include them in the extraction.
```

**Step 2: Register the prompt file in the composer**

In `prompt_composer.py`, update the `COMMAND_MODULES` entry to include the new file:

```python
"story_chat": ["storybank_guide", "differentiation", "story_chat"],
```

**Step 3: Commit**

```bash
git add backend/api/prompts/story_chat.txt backend/api/services/prompt_composer.py
git commit -m "feat: add story conversation prompt with extraction protocol"
```

---

## Task 3: Add resume context to build_user_context

**Files:**
- Modify: `backend/api/services/ai_coach.py` (`build_user_context` method, ~line 66)

**Step 1: Fetch resume analysis alongside existing context queries**

In `build_user_context`, after the existing queries for profile/stories/scores/coaching_strategy, add:

```python
# Resume analysis (if available)
resume_resp = db.table("resume_analysis").select(
    "positioning_strengths, story_seeds, career_narrative_gaps"
).eq("user_id", user_id).maybe_single().execute()
```

**Step 2: Include resume in the returned context dict**

Add to the return dict:

```python
"resume": resume_resp.data if resume_resp.data else None,
```

**Step 3: Update PromptComposer to include resume context in system prompt**

In `prompt_composer.py`, inside the `compose` method, after the storybank summary section, add:

```python
# Resume context (if available)
resume = user_context.get("resume")
if resume:
    sections.append("## Resume Analysis")
    if resume.get("positioning_strengths"):
        sections.append(f"Positioning strengths: {resume['positioning_strengths']}")
    if resume.get("career_narrative_gaps"):
        sections.append(f"Career narrative gaps: {resume['career_narrative_gaps']}")
    if resume.get("story_seeds"):
        import json
        seeds = resume["story_seeds"] if isinstance(resume["story_seeds"], list) else json.loads(resume["story_seeds"])
        if seeds:
            sections.append(f"Story seeds from resume: {json.dumps(seeds)}")
```

**Step 4: Verify**

Run: `cd backend && python -c "from api.services.ai_coach import AICoachService; print('OK')"`
Expected: `OK`

**Step 5: Commit**

```bash
git add backend/api/services/ai_coach.py backend/api/services/prompt_composer.py
git commit -m "feat: include resume analysis in user context for story coaching"
```

---

## Task 4: Add resume seeding + duplicate detection to conversation prompt

**Files:**
- Modify: `backend/api/prompts/story_chat.txt`

**Step 1: Add resume-aware opening logic**

Insert after the "Conversation Flow" heading, before item 1:

```text
### Resume Context (if available)

If the user's resume analysis is provided in the context:
- **Proactive seeding (when user has 0 stories):** Open by referencing a specific experience from their resume. Example: "I see from your resume you scaled the eng team at Acme from 8 to 27 — that sounds like a powerful story. Want to start there?" Pick the most compelling story seed.
- **Reactive connection (when user has 1+ stories):** Do NOT lead with resume references. Instead, when the user starts describing an experience, connect it: "That lines up with what I see on your resume about the migration project — great context. Tell me more about your specific role."
- If no resume data is available, proceed normally with reflective prompts.
```

**Step 2: Add duplicate story detection rules**

Insert into the "### Rules" section:

```text
- **Duplicate detection:** Before capturing a new story, check if it substantially overlaps with an existing story in the user's storybank (provided in context). If it does, say: "This sounds similar to your story '[existing title]'. Would you like to improve that one instead, or is this a genuinely different angle?" If the user confirms it's different, proceed. If they want to improve, guide them to strengthen the existing story instead.
- When referencing existing stories, use their exact titles from the storybank context.
```

**Step 3: Commit**

```bash
git add backend/api/prompts/story_chat.txt
git commit -m "feat: add resume seeding and duplicate detection to story chat prompt"
```

---

## Task 5: Add streaming method to AICoachService

**Files:**
- Modify: `backend/api/services/ai_coach.py` (add `coach_stream` method after existing `coach_json` method, ~line 64)

**Step 1: Add the `coach_stream` async generator method**

Add this method to the `AICoachService` class:

```python
async def coach_stream(self, command: str, user_context: dict, messages: list[dict]):
    """Stream OpenAI response tokens. Accepts full conversation history."""
    system_prompt = PromptComposer.compose(command, user_context)
    client = get_openai()
    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[{"role": "system", "content": system_prompt}] + messages,
        temperature=0.7,
        max_tokens=2000,
        stream=True,
    )
    async for chunk in response:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
```

**Step 2: Verify it doesn't break existing imports**

Run: `cd backend && python -c "from api.services.ai_coach import AICoachService; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/api/services/ai_coach.py
git commit -m "feat: add coach_stream async generator for SSE responses"
```

---

## Task 6: Add SSE streaming endpoint to stories router

**Files:**
- Modify: `backend/api/routers/stories.py` (add new endpoint after existing `discover_stories`)

**Step 1: Add imports at top of file**

```python
from fastapi.responses import StreamingResponse
import json as json_mod
```

**Step 2: Add the Pydantic model for chat requests**

After the existing `DiscoverRequest` model:

```python
class StoryChatRequest(BaseModel):
    messages: list[dict]  # [{"role": "user"|"assistant", "content": "..."}]
```

**Step 3: Add the SSE endpoint**

```python
@router.post("/chat")
async def story_chat(req: StoryChatRequest, user: AuthUser = Depends(get_current_user)):
    """Stream a story coaching conversation via SSE."""
    user_context = await coach.build_user_context(user.id)

    async def event_stream():
        buffer = ""
        in_extract = False
        extract_buffer = ""

        async for token in coach.coach_stream("story_chat", user_context, req.messages):
            buffer += token

            # Check if we've entered the extraction block
            if "|||STORY_EXTRACT|||" in buffer and not in_extract:
                # Send everything before the marker as text
                before = buffer.split("|||STORY_EXTRACT|||")[0]
                if before:
                    # Send any unsent text before the marker
                    pass  # Already sent token-by-token before this point
                in_extract = True
                extract_buffer = buffer.split("|||STORY_EXTRACT|||")[1]
                continue

            if in_extract:
                extract_buffer += token
                # Check if extraction is complete
                if "|||END_EXTRACT|||" in extract_buffer:
                    json_str = extract_buffer.split("|||END_EXTRACT|||")[0].strip()
                    try:
                        story_data = json_mod.loads(json_str)
                        yield f"event: story_complete\ndata: {json_mod.dumps(story_data)}\n\n"
                    except json_mod.JSONDecodeError:
                        # If JSON parsing fails, send raw text
                        yield f"event: token\ndata: {json_mod.dumps({'text': json_str})}\n\n"
                    in_extract = False
                continue

            # Normal token — check we haven't started entering the marker
            # Buffer the last few chars in case marker spans tokens
            marker = "|||STORY_EXTRACT|||"
            # If buffer might be starting the marker, hold tokens
            if any(marker.startswith(buffer[-i:]) for i in range(1, min(len(buffer), len(marker)) + 1) if buffer[-i:] != buffer):
                continue

            yield f"event: token\ndata: {json_mod.dumps({'text': token})}\n\n"

        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

**Step 4: Verify syntax**

Run: `cd backend && python -c "from api.routers.stories import router; print('OK')"`
Expected: `OK`

**Step 5: Commit**

```bash
git add backend/api/routers/stories.py
git commit -m "feat: add POST /api/stories/chat SSE streaming endpoint"
```

---

## Task 7: Simplify SSE endpoint — cleaner marker detection

The marker detection in Task 4 has edge cases with token boundaries. Replace with a simpler approach: accumulate the full response, then check for the marker at the end. Stream tokens as they arrive, but also buffer them. After the stream ends, check the full buffer for extraction.

**Files:**
- Modify: `backend/api/routers/stories.py` (replace the `story_chat` endpoint)

**Step 1: Rewrite with post-stream extraction**

```python
@router.post("/chat")
async def story_chat(req: StoryChatRequest, user: AuthUser = Depends(get_current_user)):
    """Stream a story coaching conversation via SSE."""
    user_context = await coach.build_user_context(user.id)

    async def event_stream():
        full_response = ""

        async for token in coach.coach_stream("story_chat", user_context, req.messages):
            full_response += token

            # Don't stream tokens that are part of the extraction block
            if "|||STORY_EXTRACT" in full_response:
                continue

            yield f"event: token\ndata: {json_mod.dumps({'text': token})}\n\n"

        # After stream completes, check for extraction
        if "|||STORY_EXTRACT|||" in full_response and "|||END_EXTRACT|||" in full_response:
            json_str = full_response.split("|||STORY_EXTRACT|||")[1].split("|||END_EXTRACT|||")[0].strip()
            try:
                story_data = json_mod.loads(json_str)
                yield f"event: story_complete\ndata: {json_mod.dumps(story_data)}\n\n"
            except json_mod.JSONDecodeError:
                pass

        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

**Step 2: Verify**

Run: `cd backend && python -c "from api.routers.stories import router; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/api/routers/stories.py
git commit -m "refactor: simplify SSE marker detection with post-stream extraction"
```

---

## Task 8: Create useStoryChat hook for frontend SSE streaming

**Files:**
- Create: `frontend/src/hooks/useStoryChat.ts`

**Step 1: Write the hook**

```typescript
import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface ChatMessage {
  role: 'coach' | 'user';
  text: string;
}

interface StoryExtract {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  primarySkill: string;
  secondarySkill: string;
  earnedSecret: string;
  strength: number;
  domain: string;
  deployFor: string;
}

interface UseStoryChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  storyExtract: StoryExtract | null;
  sendMessage: (text: string) => Promise<void>;
  resetChat: (opening?: ChatMessage[]) => void;
}

const API_URL = import.meta.env.VITE_API_URL || '';

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  // Fallback to localStorage
  const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  for (const key of keys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '');
      if (parsed?.access_token) return parsed.access_token;
    } catch { /* skip */ }
  }
  return null;
}

export function useStoryChat(openingMessages: ChatMessage[] = []): UseStoryChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(openingMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [storyExtract, setStoryExtract] = useState<StoryExtract | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);

    // Build conversation history for the API (all messages including the new one)
    const allMessages = [...messages, userMsg];
    const apiMessages = allMessages.map(m => ({
      role: m.role === 'coach' ? 'assistant' : 'user',
      content: m.text,
    }));

    setIsStreaming(true);

    // Add empty coach message that we'll stream into
    setMessages(prev => [...prev, { role: 'coach', text: '' }]);

    try {
      const token = await getToken();
      abortRef.current = new AbortController();

      const response = await fetch(`${API_URL}/api/stories/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              if (eventType === 'token' && parsed.text) {
                // Append token to the last coach message
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === 'coach') {
                    updated[updated.length - 1] = { ...last, text: last.text + parsed.text };
                  }
                  return updated;
                });
              } else if (eventType === 'story_complete') {
                setStoryExtract(parsed as StoryExtract);
              }
              // 'done' event — no action needed
            } catch { /* skip unparseable */ }
            eventType = '';
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        // Add error message to chat
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'coach' && last.text === '') {
            updated[updated.length - 1] = {
              ...last,
              text: 'Sorry, I had trouble connecting. Please try again.',
            };
          }
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
    }
  }, [messages]);

  const resetChat = useCallback((opening: ChatMessage[] = []) => {
    abortRef.current?.abort();
    setMessages(opening);
    setStoryExtract(null);
    setIsStreaming(false);
  }, []);

  return { messages, isStreaming, storyExtract, sendMessage, resetChat };
}
```

**Step 2: Verify types compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/hooks/useStoryChat.ts
git commit -m "feat: add useStoryChat hook with SSE streaming and extraction"
```

---

## Task 9: Replace dummy AI in StoryBuilder with real streaming

**Files:**
- Modify: `frontend/src/components/StoryBuilder.tsx`

**Step 1: Remove dummy code, integrate useStoryChat**

Replace the imports and remove the dummy simulation. The key changes:

1. Import `useStoryChat` and remove `simulateCoachReply`
2. Use `messages` and `isStreaming` from the hook
3. When `storyExtract` arrives, populate the draft and expand the card
4. Show typing indicator while streaming
5. Remove the `recentlyFilled` incremental field tracking — fields populate all at once

Updated component top section:

```typescript
import { useState, useRef, useEffect } from 'react';
import { useStoryChat } from '../hooks/useStoryChat';
import './story-builder.css';
```

Remove: `OPENING_PROMPTS`, `EXISTING_STORY_PROMPTS` constants, `simulateCoachReply` function, the local `messages` and `recentlyFilled` state.

Replace with:

```typescript
const OPENING: ChatMessage[] = [
  {
    role: 'coach',
    text: "Let's surface a great interview story. Don't worry about structure yet — I'll help shape it.\n\nThink about a moment at work where you were at your best. What comes to mind?",
  },
];

const existingOpening = (title: string): ChatMessage[] => [
  {
    role: 'coach',
    text: `I've loaded your story "${title}". I can see the details on the right.\n\nWould you like to strengthen a specific section, extract a deeper earned secret, or practice telling this story in 90 seconds?`,
  },
];
```

In the component body, replace state management:

```typescript
const isExisting = !!(initial && initial.title);
const { messages, isStreaming, storyExtract, sendMessage } = useStoryChat(
  isExisting ? existingOpening(initial!.title!) : OPENING,
);
const [mode, setMode] = useState<'chat' | 'voice'>('chat');
const [inputText, setInputText] = useState('');
const [isRecording, setIsRecording] = useState(false);
const [cardExpanded, setCardExpanded] = useState(isExisting);
const [draft, setDraft] = useState<StoryDraft>({ ...EMPTY, ...initial });
const [justExtracted, setJustExtracted] = useState(false);
```

Add effect for story extraction:

```typescript
useEffect(() => {
  if (storyExtract) {
    setDraft(prev => ({ ...prev, ...storyExtract }));
    setCardExpanded(true);
    setJustExtracted(true);
    setTimeout(() => setJustExtracted(false), 2500);
  }
}, [storyExtract]);
```

Replace `handleSend`:

```typescript
const handleSend = () => {
  if (!inputText.trim() || isStreaming) return;
  sendMessage(inputText.trim());
  setInputText('');
};
```

**Step 2: Add typing indicator in the chat messages area**

After the messages map, before `messagesEndRef`:

```tsx
{isStreaming && messages[messages.length - 1]?.text === '' && (
  <div className="sb-typing">
    <div className="sb-typing-dot" />
    <div className="sb-typing-dot" />
    <div className="sb-typing-dot" />
  </div>
)}
```

**Step 3: Apply `just-filled` class to ALL fields when extraction happens**

Replace individual `recentlyFilled.has('fieldName')` checks with `justExtracted`:

```tsx
<div className={`sb-field ${justExtracted ? 'just-filled' : ''}`}>
```

Apply this to all fields in the story card.

**Step 4: Disable send button while streaming**

```tsx
<button className="sb-send-btn" onClick={handleSend} disabled={isStreaming}>
```

**Step 5: Verify compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

**Step 6: Commit**

```bash
git add frontend/src/components/StoryBuilder.tsx
git commit -m "feat: replace dummy AI with real SSE streaming in StoryBuilder"
```

---

## Task 10: Update addStory mutation to send all STAR fields

**Files:**
- Modify: `frontend/src/hooks/useStories.ts` (lines 56-70, the `addMutation`)
- Modify: `frontend/src/pages/Storybank.tsx` (lines 141-155, the `onSave` callback)

**Step 1: Expand the mutation to send STAR fields**

In `useStories.ts`, update the `mutationFn`:

```typescript
const addMutation = useMutation({
  mutationFn: async (story: Record<string, unknown>) => {
    const { data } = await api.post('/api/stories', {
      title: story.title,
      situation: story.situation,
      task: story.task,
      action: story.action,
      result: story.result,
      primary_skill: story.primarySkill,
      secondary_skill: story.secondarySkill,
      earned_secret: story.earnedSecret,
      strength: story.strength,
      domain: story.domain,
      deploy_for: story.deployFor,
    });
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['stories'] });
  },
});
```

**Step 2: Pass all fields from Storybank onSave**

In `Storybank.tsx`, update the `onSave` callback:

```tsx
<StoryBuilder
  onSave={(data) => {
    addStory(data);
    setShowForm(false);
  }}
  onCancel={() => setShowForm(false)}
/>
```

**Step 3: Verify compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add frontend/src/hooks/useStories.ts frontend/src/pages/Storybank.tsx
git commit -m "feat: send all STAR fields when saving a story"
```

---

## Task 11: Wire existing story editing — View/Improve opens StoryBuilder

**Files:**
- Modify: `frontend/src/hooks/useStories.ts` (update `fetchStories` to include STAR fields, add `Story` fields)
- Modify: `frontend/src/pages/Storybank.tsx` (add `editingStory` state, pass `initial` to StoryBuilder)

**Step 1: Expand Story interface and fetch**

In `useStories.ts`, update the interface:

```typescript
export interface Story {
  id: string;
  fullId: string; // full UUID for API calls
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  primarySkill: string;
  secondarySkill: string;
  earnedSecret: string;
  strength: number;
  uses: number;
  domain: string;
  deployFor: string;
  status: 'improve' | 'view';
}
```

Update `fetchStories` mapping:

```typescript
return (data || []).map((s: any) => ({
  id: s.id?.substring(0, 8) || s.id,
  fullId: s.id,
  title: s.title,
  situation: s.situation || '',
  task: s.task || '',
  action: s.action || '',
  result: s.result || '',
  primarySkill: s.primary_skill || '',
  secondarySkill: s.secondary_skill || '',
  earnedSecret: s.earned_secret || '',
  strength: s.strength || 3,
  uses: s.use_count || 0,
  domain: s.domain || '',
  deployFor: s.deploy_for || '',
  status: (s.strength || 0) >= 5 ? 'view' as const : 'improve' as const,
}));
```

**Step 2: Add editing state to Storybank page**

```typescript
const [editingStory, setEditingStory] = useState<Story | null>(null);
const showBuilder = showForm || editingStory !== null;
```

Update the builder rendering:

```tsx
{showBuilder && (
  <StoryBuilder
    initial={editingStory ? {
      title: editingStory.title,
      situation: editingStory.situation,
      task: editingStory.task,
      action: editingStory.action,
      result: editingStory.result,
      primarySkill: editingStory.primarySkill,
      secondarySkill: editingStory.secondarySkill,
      earnedSecret: editingStory.earnedSecret,
      strength: editingStory.strength,
      domain: editingStory.domain,
      deployFor: editingStory.deployFor,
    } : undefined}
    onSave={(data) => {
      addStory(data);
      setShowForm(false);
      setEditingStory(null);
    }}
    onCancel={() => {
      setShowForm(false);
      setEditingStory(null);
    }}
  />
)}
```

**Step 3: Wire the View/Improve button**

Update the table row button:

```tsx
<td>
  <button
    className="btn btn-outline btn-sm"
    onClick={() => setEditingStory(s)}
  >
    {s.status === 'view' ? 'View' : 'Improve'}
  </button>
</td>
```

**Step 4: Verify compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add frontend/src/hooks/useStories.ts frontend/src/pages/Storybank.tsx
git commit -m "feat: wire existing story editing through StoryBuilder"
```

---

## Task 12: Fix StoryBuilder page dimensions

**Files:**
- Modify: `frontend/src/components/story-builder.css`

**Step 1: Update height calculation**

The StoryBuilder lives inside `main.main` which has:
- Desktop: `padding: 24px`
- `--topbar-h: 56px`
- Page header: ~52px (h1 + subtitle + 20px margin)

Replace the height rule:

```css
.story-builder {
  display: flex;
  gap: 0;
  /* Available height = viewport - topbar - main padding (top+bottom) - page header - margin */
  height: calc(100vh - var(--topbar-h) - 48px - 52px - 14px);
  min-height: 480px;
  max-height: 800px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--card);
  box-shadow: var(--shadow-xs);
  overflow: hidden;
}
```

**Step 2: Update responsive breakpoints**

```css
@media (max-width: 768px) {
  .story-builder {
    flex-direction: column;
    height: calc(100vh - var(--topbar-h) - 32px - 52px - 14px);
    min-height: 400px;
    max-height: none;
  }

  .sb-divider {
    width: 100%;
    height: 1px;
  }

  .sb-card-panel {
    width: 100%;
    max-height: 50vh;
  }

  .sb-card-panel.collapsed {
    width: 100%;
    height: 48px;
    max-height: 48px;
  }
}
```

**Step 3: Verify visually**

Run the dev server and check:
1. Desktop (1440px wide): builder fills available height, no page scrollbar
2. Tablet (1024px): sidebar collapses, builder adjusts
3. Mobile (375px): stacks vertically, card below chat

**Step 4: Commit**

```bash
git add frontend/src/components/story-builder.css
git commit -m "fix: correct StoryBuilder dimensions for all viewport sizes"
```

---

## Task 13: Wire ElevenLabs voice mode for story conversations

**Architecture:** ElevenLabs ConvAI handles the voice coaching (its own LLM + voice). Transcripts appear in the chat panel in real-time. When the voice session ends, the full transcript is sent to our backend's `POST /api/stories/chat` for extraction through the same pipeline as chat mode. This means the story extraction is always done by our backend, regardless of whether the user used chat or voice.

**Files:**
- Modify: `backend/config.py` (add `ELEVENLABS_STORY_AGENT_ID`)
- Modify: `backend/api/services/voice_service.py` (accept agent_id parameter)
- Modify: `backend/api/routers/voice.py` (add story-specific signed-url endpoint)
- Create: `frontend/src/hooks/useStoryVoice.ts`
- Modify: `frontend/src/components/StoryBuilder.tsx` (integrate voice hook + post-session extraction)

**Step 0: Add story agent ID to backend config**

In `backend/config.py`, add to the Settings class:

```python
ELEVENLABS_STORY_AGENT_ID: str = ""
```

In `backend/api/services/voice_service.py`, update `get_signed_url` to accept an optional `agent_id` parameter, falling back to the default `ELEVENLABS_AGENT_ID` if not provided.

In `backend/api/routers/voice.py`, add a new endpoint:

```python
@router.get("/story-signed-url")
async def get_story_signed_url(user: AuthUser = Depends(get_current_user)):
    url = await voice_service.get_signed_url(agent_id=settings.ELEVENLABS_STORY_AGENT_ID)
    return {"signed_url": url}
```

**Step 1: Create the voice hook**

```typescript
import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || '';

interface UseStoryVoiceReturn {
  isConnected: boolean;
  isListening: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

async function getSignedUrl(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${API_URL}/api/voice/story-signed-url`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Failed to get voice URL');
  const data = await res.json();
  return data.signed_url;
}

export function useStoryVoice(
  onTranscript: (text: string, role: 'user' | 'coach') => void,
  onSessionEnd?: () => void,
): UseStoryVoiceReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(async () => {
    try {
      const url = await getSignedUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsListening(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // ElevenLabs ConvAI message types
          if (msg.type === 'transcript' && msg.text) {
            onTranscript(msg.text, msg.role === 'agent' ? 'coach' : 'user');
          }
        } catch { /* skip */ }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsListening(false);
        onSessionEnd?.();
      };

      ws.onerror = () => {
        setIsConnected(false);
        setIsListening(false);
      };
    } catch {
      setIsConnected(false);
    }
  }, [onTranscript]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
    setIsListening(false);
  }, []);

  return { isConnected, isListening, connect, disconnect };
}
```

**Step 1b: Update the disconnect function to also trigger onSessionEnd**

```typescript
  const disconnect = useCallback(() => {
    wsRef.current?.close(); // triggers onclose → onSessionEnd
    wsRef.current = null;
  }, []);
```

**Step 2: Integrate into StoryBuilder with post-session extraction**

In StoryBuilder, when `mode === 'voice'`:

```typescript
// Collect transcripts for post-session extraction
const transcriptRef = useRef<{role: string, text: string}[]>([]);

const handleVoiceTranscript = useCallback((text: string, role: 'user' | 'coach') => {
  transcriptRef.current.push({ role, text });
  // Also show in chat panel
  setMessages(prev => [...prev, { role, text }]);
}, []);

const handleVoiceEnd = useCallback(() => {
  // When voice session ends, send transcript to backend for extraction
  const transcript = transcriptRef.current
    .map(t => `${t.role === 'coach' ? 'Coach' : 'User'}: ${t.text}`)
    .join('\n');
  if (transcript.trim()) {
    sendMessage(`Please extract a STAR story from this voice conversation transcript:\n\n${transcript}`);
  }
  transcriptRef.current = [];
}, [sendMessage]);

const { isConnected, isListening, connect, disconnect } = useStoryVoice(
  handleVoiceTranscript,
  handleVoiceEnd, // called when WebSocket closes
);
```

Update the voice area rendering:

```tsx
<div className="sb-voice-area">
  <div className="sb-voice-hint">
    {!isConnected ? 'Click to start voice conversation' :
     isListening ? 'Listening...' : 'Speaking...'}
  </div>
  <button
    className={`sb-mic-btn ${isListening ? 'recording' : ''}`}
    onClick={() => isConnected ? disconnect() : connect()}
  >
    {/* mic icon SVG */}
  </button>
  {isListening && (
    <div className="voice-bars">
      {[1,2,3,4,5,6,7].map(n => <div key={n} className="voice-bar" />)}
    </div>
  )}
</div>
```

**Step 3: Verify compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add frontend/src/hooks/useStoryVoice.ts frontend/src/components/StoryBuilder.tsx
git commit -m "feat: wire ElevenLabs voice mode for story conversations"
```

---

## Task 14: Re-enable onboarding redirect

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx` (line ~519)

**Step 1: Uncomment the onboarding redirect**

```typescript
  // New user — redirect to onboarding
  if (!hasProfile) {
    window.location.href = '/onboarding';
    return null;
  }
```

**Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "fix: re-enable onboarding redirect after prototype review"
```

---

## Task 15: End-to-end manual test

**Step 1: Start backend**

Run: `cd backend && uvicorn main:app --reload --port 8000`

**Step 2: Start frontend**

Run: `cd frontend && npm run dev`

**Step 3: Test new story flow**

1. Navigate to `/stories`
2. Click "Add Story"
3. Verify chat panel opens with coach greeting, card panel collapsed
4. Type a response about a work experience
5. Verify streaming response appears token-by-token
6. Continue conversation for 3-4 turns
7. When coach says "I have everything I need", verify:
   - Story card expands
   - All STAR fields populate at once with green highlight
   - Progress bar shows filled count
8. Review fields, make edits
9. Click "Save Story"
10. Verify story appears in the table

**Step 4: Test resume-aware story discovery**

1. Upload a resume via the Materials page (or seed a `resume_analysis` row in Supabase with `story_seeds` and `positioning_strengths`)
2. With 0 stories: Click "Add Story" — verify coach proactively references a resume experience in its opening message
3. Save that story. Click "Add Story" again — verify coach does NOT lead with resume this time (reactive mode since stories > 0)
4. Describe an experience that matches something on the resume — verify coach connects it naturally

**Step 5: Test duplicate story detection**

1. Have at least 1 saved story (e.g., "Scaled Eng Team from 8 to 27")
2. Click "Add Story" and start describing the same experience
3. Verify coach recognizes the overlap and asks: "This sounds similar to your story 'Scaled Eng Team from 8 to 27'. Would you like to improve that one instead?"
4. Respond "it's different" — verify coach proceeds with new story capture
5. Alternatively respond "yes improve it" — verify coach pivots to improvement mode

**Step 6: Test existing story flow**

1. Click "Improve" on a story in the table
2. Verify StoryBuilder opens with card expanded and pre-filled
3. Verify coach offers strengthen/extract/practice options
4. Have a conversation about improving the story

**Step 7: Test voice mode**

1. Open StoryBuilder
2. Toggle to "Voice" mode
3. Click mic button
4. Verify connection to ElevenLabs
5. Speak and verify transcripts appear in chat

**Step 8: Test responsive**

1. Resize browser to tablet width (1024px)
2. Resize to mobile width (375px)
3. Verify layout adapts: stacks vertically on mobile, no overflow
