# LinkedIn Page Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the LinkedIn page with PDF upload support, 9-section audit based on interview-coach-skill, split-pane layout with coach chat, and cross-surface consistency checks against the resume.

**Architecture:** Add PDF upload to the LinkedIn audit endpoint (reusing pymupdf from resume). Upgrade the AI prompt to perform the full 9-section audit from the interview-coach-skill. Restructure the LinkedIn page to match the Resume page pattern: left panel (audit results as sections) + right panel (coach chat). Store the full profile text so users can re-audit without re-uploading.

**Tech Stack:** React 19, TypeScript, FastAPI, pymupdf, OpenAI (gpt-4o), Supabase, SSE streaming.

---

## Task 1: Update linkedin_analysis schema for richer audit data

**Files:**
- Create: `backend/db/migrations/007_linkedin_upgrade.sql`

**Step 1: Write the migration**

```sql
-- Store the raw profile text so users don't have to re-upload
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS profile_text TEXT;

-- Store section-by-section audit results
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS headline_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS about_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS experience_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS skills_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS photo_banner_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS featured_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS recommendations_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS url_completeness_assessment JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS content_strategy JSONB;
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS cross_surface_gaps JSONB DEFAULT '[]';

-- Store how the profile was submitted
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'text';
ALTER TABLE linkedin_analysis ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
```

**Step 2: Apply via Supabase MCP**

**Step 3: Commit**
```bash
git add backend/db/migrations/007_linkedin_upgrade.sql
git commit -m "feat: add section-by-section fields to linkedin_analysis for 9-section audit"
```

---

## Task 2: Add PDF upload to LinkedIn audit endpoint

**Files:**
- Modify: `backend/api/routers/materials.py:117-153`
- Modify: `backend/api/services/pitch_service.py:50-79`

**Step 1: Update the audit endpoint to accept file upload OR text**

In `backend/api/routers/materials.py`, replace the LinkedIn section:

```python
# --- LinkedIn ---

class LinkedInAuditRequest(BaseModel):
    linkedin_text: str


@router.get("/linkedin")
async def get_linkedin(
    user: AuthUser = Depends(get_current_user),
):
    """Get stored LinkedIn analysis."""
    db = get_supabase()
    try:
        resp = (
            db.table("linkedin_analysis")
            .select("*")
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(404, "No LinkedIn analysis found.")
    if not resp or not resp.data:
        return None
    return resp.data


@router.post("/linkedin/audit")
async def audit_linkedin(
    user: AuthUser = Depends(get_current_user),
    linkedin_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """AI LinkedIn profile audit. Accepts text OR PDF upload."""
    if file and file.filename:
        content = await file.read()
        if file.filename.lower().endswith(".pdf"):
            try:
                import pymupdf
                doc = pymupdf.open(stream=content, filetype="pdf")
                pages = [page.get_text() for page in doc]
                doc.close()
                text = "\n".join(pages).replace("\x00", "")
            except Exception:
                text = content.decode("utf-8", errors="ignore").replace("\x00", "")
        else:
            text = content.decode("utf-8", errors="ignore").replace("\x00", "")
        source = "pdf"
    elif linkedin_text:
        text = linkedin_text
        source = "text"
    else:
        raise HTTPException(400, "Provide linkedin_text or upload a file")

    user_context = await coach.build_user_context(user.id)
    analysis = await pitch_service.audit_linkedin(text, user_context)
    saved = await pitch_service.save_linkedin(user.id, analysis, profile_text=text, source=source)
    return {"analysis": saved}
```

**Step 2: Upgrade audit_linkedin in pitch_service to do 9-section audit**

In `backend/api/services/pitch_service.py`, replace `audit_linkedin` and `save_linkedin`:

```python
async def audit_linkedin(self, linkedin_text: str, user_context: dict) -> dict:
    """AI LinkedIn profile audit — 9-section audit based on interview-coach-skill."""
    message = (
        f"## LinkedIn Profile Content\n{linkedin_text}\n\n"
        f"## Instructions\n"
        f"Perform a comprehensive 9-section LinkedIn profile audit. Return JSON with:\n"
        f"- overall: overall assessment (2-3 sentences)\n"
        f"- recruiter_discoverability: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
        f"- credibility_score: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
        f"- differentiation_score: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
        f"- headline_assessment: object with 'current', 'assessment', 'recommended', 'rationale'\n"
        f"- about_assessment: object with 'assessment', 'recommended', 'rationale'\n"
        f"- experience_assessment: object with 'assessment', 'recommended_rewrite' (most recent role), 'rationale'\n"
        f"- skills_assessment: object with 'assessment', 'recommended_top_10' (ordered list), 'rationale'\n"
        f"- photo_banner_assessment: object with 'assessment', 'recommendations'\n"
        f"- featured_assessment: object with 'assessment', 'recommendations' (2-3 specific items)\n"
        f"- recommendations_assessment: object with 'count_guidance', 'who_to_ask', 'how_to_ask'\n"
        f"- url_completeness_assessment: object with 'custom_url', 'completeness', 'open_to_work_guidance'\n"
        f"- content_strategy: object with 'posting_approach', 'post_ideas' (list of 3), 'engagement_tips'\n"
        f"- top_fixes: ordered list of 5 highest-impact changes, each with 'section', 'issue', 'fix', 'severity' ('red'/'amber'/'neutral')\n"
        f"- positioning_gaps: where the profile doesn't match target roles or resume positioning\n"
        f"- cross_surface_gaps: list of inconsistencies between LinkedIn and resume (if resume data available in context)"
    )
    raw = await self.coach.coach_json("linkedin", user_context, message)
    return json.loads(raw)

async def save_linkedin(self, user_id: str, analysis: dict, profile_text: str = "", source: str = "text") -> dict:
    """Persist LinkedIn analysis with section-by-section data."""
    db = get_supabase()
    data = {
        "user_id": user_id,
        "overall": analysis.get("overall"),
        "recruiter_discoverability": analysis.get("recruiter_discoverability"),
        "credibility_score": analysis.get("credibility_score"),
        "differentiation_score": analysis.get("differentiation_score"),
        "top_fixes": analysis.get("top_fixes", []),
        "positioning_gaps": analysis.get("positioning_gaps"),
        "headline_assessment": analysis.get("headline_assessment"),
        "about_assessment": analysis.get("about_assessment"),
        "experience_assessment": analysis.get("experience_assessment"),
        "skills_assessment": analysis.get("skills_assessment"),
        "photo_banner_assessment": analysis.get("photo_banner_assessment"),
        "featured_assessment": analysis.get("featured_assessment"),
        "recommendations_assessment": analysis.get("recommendations_assessment"),
        "url_completeness_assessment": analysis.get("url_completeness_assessment"),
        "content_strategy": analysis.get("content_strategy"),
        "cross_surface_gaps": analysis.get("cross_surface_gaps", []),
        "profile_text": profile_text,
        "source": source,
    }
    resp = db.table("linkedin_analysis").upsert(data, on_conflict="user_id").execute()
    return resp.data[0]
```

**Step 3: Verify backend starts**

Run: `python3 -c "from backend.api.routers.materials import router; print('OK')"`

**Step 4: Commit**
```bash
git add backend/api/routers/materials.py backend/api/services/pitch_service.py
git commit -m "feat: LinkedIn audit accepts PDF upload, performs 9-section audit"
```

---

## Task 3: Create LinkedIn coach chat endpoint

**Files:**
- Create: `backend/api/prompts/linkedin_chat.txt`
- Modify: `backend/api/services/prompt_composer.py` (add linkedin_chat to COMMAND_MODULES)
- Modify: `backend/api/routers/materials.py` (add chat endpoint)

**Step 1: Create the LinkedIn chat prompt**

Create `backend/api/prompts/linkedin_chat.txt`:
```text
## LinkedIn Profile Coach

You are a LinkedIn profile optimization coach. You help candidates improve their LinkedIn profile through conversational coaching.

Your capabilities:
- Rewrite headlines optimized for recruiter boolean search
- Craft compelling About sections with narrative hooks (first 3 lines visible before "see more")
- Improve experience descriptions with accomplishment-oriented language
- Recommend optimal skills ordering for recruiter search filters
- Advise on content strategy (posting cadence, content types, engagement)
- Cross-reference resume positioning for consistency

When suggesting a specific rewrite, format it as:
- Quote the current text
- Provide your rewritten version
- Explain why the change improves discoverability/credibility

LinkedIn is NOT a resume mirror — optimize for how the platform actually works:
- Headline has highest search weight (220 chars max)
- Skills are the ONLY filterable field in recruiter search
- About section: first 3 lines must hook before "see more"
- Content engagement: comments are 15x more valuable than likes

Focus on high-impact changes first. Reference the audit findings to guide priorities.
Be direct and specific — never give generic advice.
```

**Step 2: Register prompt module**

In `backend/api/services/prompt_composer.py`, add to COMMAND_MODULES:
```python
"linkedin_chat": ["differentiation", "cross_cutting", "linkedin_chat"],
```

**Step 3: Add chat SSE endpoint**

In `backend/api/routers/materials.py`, add after the audit endpoint:

```python
class LinkedInChatRequest(BaseModel):
    messages: list[dict]
    session_id: Optional[str] = None

@router.post("/linkedin/chat")
async def linkedin_chat(
    req: LinkedInChatRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Stream a LinkedIn coaching conversation via SSE."""
    db = get_supabase()
    user_context = await coach.build_user_context(user.id)

    # Inject LinkedIn profile context
    linkedin_resp = db.table("linkedin_analysis").select("profile_text,overall,top_fixes").eq("user_id", user.id).maybe_single().execute()
    context_parts = []
    if linkedin_resp and linkedin_resp.data:
        lt = linkedin_resp.data
        if lt.get("profile_text"):
            context_parts.append(f"Profile text: {lt['profile_text'][:3000]}")
        if lt.get("overall"):
            context_parts.append(f"Audit: {lt['overall']}")
        if lt.get("top_fixes"):
            context_parts.append(f"Top fixes: {json_mod.dumps(lt['top_fixes'])}")

    context_msg = {"role": "user", "content": f"[CONTEXT — LinkedIn profile]\n{chr(10).join(context_parts)}"}
    chat_messages = [context_msg] + [
        {"role": m.get("role", "user"), "content": m.get("content", "")}
        for m in req.messages
    ]

    async def event_stream():
        full_response = ""
        async for token in coach.coach_stream("linkedin_chat", user_context, chat_messages):
            full_response += token
            yield f"event: token\ndata: {json_mod.dumps({'text': token})}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

Add needed imports at top of materials.py:
```python
import json as json_mod
from fastapi.responses import StreamingResponse
```

**Step 4: Commit**
```bash
git add backend/api/prompts/linkedin_chat.txt backend/api/services/prompt_composer.py backend/api/routers/materials.py
git commit -m "feat: add LinkedIn coach chat SSE endpoint with profile context"
```

---

## Task 4: Create useLinkedInChat hook

**Files:**
- Create: `frontend/src/hooks/useLinkedInChat.ts`

**Step 1: Write the hook** (follows useResumeChat pattern)

```typescript
import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface ChatMessage {
  role: 'coach' | 'user';
  text: string;
}

async function getToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
  } catch { /* fall through */ }
  const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  for (const key of keys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '');
      if (parsed?.access_token) return parsed.access_token;
    } catch { /* skip */ }
  }
  return null;
}

export function useLinkedInChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);

    const allMessages = [...messages, userMsg];
    const apiMessages = allMessages.map(m => ({
      role: m.role === 'coach' ? 'assistant' : 'user',
      content: m.text,
    }));

    setIsStreaming(true);
    setMessages(prev => [...prev, { role: 'coach', text: '' }]);

    try {
      const token = await getToken();
      abortRef.current = new AbortController();

      const response = await fetch('/api/materials/linkedin/chat', {
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
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (eventType === 'token' && parsed.text) {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === 'coach') {
                    updated[updated.length - 1] = { ...last, text: last.text + parsed.text };
                  }
                  return updated;
                });
              }
            } catch { /* skip */ }
            eventType = '';
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'coach' && last.text === '') {
            updated[updated.length - 1] = { ...last, text: 'Sorry, I had trouble connecting. Please try again.' };
          }
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
    }
  }, [messages]);

  const resetChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
  }, []);

  return { messages, isStreaming, sendMessage, resetChat };
}
```

**Step 2: Commit**
```bash
git add frontend/src/hooks/useLinkedInChat.ts
git commit -m "feat: add useLinkedInChat hook with SSE streaming"
```

---

## Task 5: Rebuild LinkedInPage with split-pane layout

**Files:**
- Modify: `frontend/src/pages/LinkedInPage.tsx` (full rewrite)
- Create: `frontend/src/pages/linkedin-page.css`

**Step 1: Create CSS** (follows resume-page.css pattern)

Create `frontend/src/pages/linkedin-page.css` with styles for:
- `.linkedin-page` — full height flex container
- `.linkedin-upload` — upload area with PDF dropzone + text paste tabs
- `.linkedin-split` — split pane (left: audit sections, right: chat)
- `.linkedin-left-panel` — scrollable audit results
- `.linkedin-chat-panel` — coach chat (reuse `.rc-*` classes from resume-page.css)
- `.li-section` — individual audit section cards
- `.li-section-header` — section name + severity badge
- `.li-current` / `.li-recommended` — current vs recommended text

**Step 2: Rewrite LinkedInPage**

The page has 3 states:

1. **Empty state** — two input options: Upload PDF button + "Or paste profile text" textarea
2. **Auditing state** — spinner
3. **Results state** — split pane: left (section-by-section audit with severity badges, fixes, rewrites) + right (coach chat with suggestion chips from top_fixes)

Key components:
- `AuditSection` — renders one section's assessment (current, assessment, recommended, rationale)
- `ChatPanel` — reuse the renderMarkdown + SSE chat pattern from ResumePage
- Suggestion chips from `analysis.top_fixes`

The upload accepts PDF (via file input) or text (via textarea). Tabs toggle between the two input modes.

**Step 3: Verify build**

Run: `cd frontend && npm run build`

**Step 4: Commit**
```bash
git add frontend/src/pages/LinkedInPage.tsx frontend/src/pages/linkedin-page.css
git commit -m "feat: rebuild LinkedIn page with PDF upload, 9-section audit, and coach chat"
```

---

## Summary

| Task | What Ships |
|------|-----------|
| 1 | DB schema upgrade for 9-section audit data |
| 2 | Backend: PDF upload + 9-section AI audit |
| 3 | Backend: LinkedIn coach chat SSE endpoint |
| 4 | Frontend: useLinkedInChat hook |
| 5 | Frontend: full LinkedIn page rebuild (upload + audit + chat) |

**Total: 5 tasks.** Each is independently committable.
