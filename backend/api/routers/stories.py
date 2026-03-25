"""Storybank CRUD + AI coaching endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json as json_mod
from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.story_coach import StoryCoachService
from backend.api.services.ai_coach import AICoachService

router = APIRouter(prefix="/api/stories", tags=["stories"])
story_coach = StoryCoachService()
coach = AICoachService()


# ── Pydantic models ──

class StoryCreate(BaseModel):
    title: str
    situation: Optional[str] = None
    task: Optional[str] = None
    action: Optional[str] = None
    result: Optional[str] = None
    primary_skill: Optional[str] = None
    secondary_skill: Optional[str] = None
    earned_secret: Optional[str] = None
    strength: Optional[int] = None
    domain: Optional[str] = None
    deploy_for: Optional[str] = None
    notes: Optional[str] = None


class StoryUpdate(BaseModel):
    title: Optional[str] = None
    situation: Optional[str] = None
    task: Optional[str] = None
    action: Optional[str] = None
    result: Optional[str] = None
    primary_skill: Optional[str] = None
    secondary_skill: Optional[str] = None
    earned_secret: Optional[str] = None
    strength: Optional[int] = None
    domain: Optional[str] = None
    deploy_for: Optional[str] = None
    notes: Optional[str] = None


class DiscoverRequest(BaseModel):
    prompt: Optional[str] = None


class StoryChatRequest(BaseModel):
    messages: list[dict]  # [{"role": "user"|"assistant", "content": "..."}]
    session_id: Optional[str] = None


# ── Helper: create a version snapshot ──

def _create_version(db, story_id: str, fields: dict, session_id: str | None = None, change_summary: str | None = None):
    """Create a story_version row with auto-incremented version_num."""
    # Get current max version_num for this story
    existing = (
        db.table("story_version")
        .select("version_num")
        .eq("story_id", story_id)
        .order("version_num", desc=True)
        .limit(1)
        .execute()
    )
    next_num = (existing.data[0]["version_num"] + 1) if existing.data else 1

    db.table("story_version").insert({
        "story_id": story_id,
        "session_id": session_id,
        "version_num": next_num,
        "fields": fields,
        "change_summary": change_summary,
    }).execute()
    return next_num


def _story_fields_snapshot(story_data: dict) -> dict:
    """Extract the STAR fields from a story row for version snapshot."""
    keys = [
        "title", "situation", "task", "action", "result",
        "primary_skill", "secondary_skill", "earned_secret",
        "strength", "domain", "deploy_for",
    ]
    return {k: story_data.get(k) for k in keys}


# ── Story CRUD ──

@router.get("")
async def list_stories(
    user: AuthUser = Depends(get_current_user),
    status: str = Query("active"),
):
    """List user's stories."""
    db = get_supabase()
    resp = (
        db.table("story")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", status)
        .order("created_at", desc=True)
        .execute()
    )
    return {"stories": resp.data or [], "count": len(resp.data or [])}


@router.post("")
async def create_story(
    story: StoryCreate,
    user: AuthUser = Depends(get_current_user),
):
    """Create a new story and v1 version snapshot."""
    db = get_supabase()

    # Check for duplicate title
    existing = (
        db.table("story")
        .select("id")
        .eq("user_id", user.id)
        .eq("title", story.title)
        .eq("status", "active")
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        # Return the existing story instead of creating a duplicate
        existing_story = db.table("story").select("*").eq("id", existing.data["id"]).single().execute()
        return existing_story.data

    data = {"user_id": user.id, **story.model_dump(exclude_none=True)}

    # Story seeds (from resume analysis) should not have strength
    is_seed = story.notes and "[Resume seed]" in story.notes
    if is_seed:
        data.pop("strength", None)

    resp = db.table("story").insert(data).execute()
    story_row = resp.data[0]

    # Create v1 version snapshot
    _create_version(
        db,
        story_id=story_row["id"],
        fields=_story_fields_snapshot(story_row),
        change_summary="Initial draft",
    )

    return story_row


@router.put("/{story_id}")
async def update_story(
    story_id: str,
    story: StoryUpdate,
    user: AuthUser = Depends(get_current_user),
):
    """Update a story."""
    db = get_supabase()

    existing = (
        db.table("story")
        .select("id")
        .eq("id", story_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not existing or not existing.data:
        raise HTTPException(404, "Story not found")

    update_data = story.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(400, "No fields to update")

    resp = db.table("story").update(update_data).eq("id", story_id).execute()
    return resp.data[0]


@router.delete("/{story_id}")
async def retire_story(
    story_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Soft-delete (retire) a story."""
    db = get_supabase()

    existing = (
        db.table("story")
        .select("id")
        .eq("id", story_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not existing or not existing.data:
        raise HTTPException(404, "Story not found")

    db.table("story").update({"status": "retired"}).eq("id", story_id).execute()
    return {"status": "retired", "id": story_id}


# ── Conversation endpoints ──

@router.get("/{story_id}/conversations")
async def list_conversations(
    story_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """List all conversation sessions for a story."""
    db = get_supabase()
    resp = (
        db.table("story_conversation")
        .select("id, story_id, status, created_at, updated_at")
        .eq("story_id", story_id)
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"conversations": resp.data or []}


@router.get("/{story_id}/conversations/active")
async def get_active_conversation(
    story_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Get the active conversation session for a story, if one exists."""
    db = get_supabase()
    resp = (
        db.table("story_conversation")
        .select("*")
        .eq("story_id", story_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(404, "No active conversation")
    return resp.data


@router.post("/{story_id}/conversations")
async def create_conversation(
    story_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Create a new active conversation session. Fails if one already exists."""
    db = get_supabase()

    # Check for existing active session
    existing = (
        db.table("story_conversation")
        .select("id")
        .eq("story_id", story_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        raise HTTPException(409, "An active conversation already exists for this story")

    resp = db.table("story_conversation").insert({
        "story_id": story_id if story_id != "new" else None,
        "user_id": user.id,
        "messages": [],
        "status": "active",
    }).execute()
    return resp.data[0]


@router.put("/conversations/{session_id}/abandon")
async def abandon_conversation(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Mark a conversation session as abandoned."""
    db = get_supabase()

    existing = (
        db.table("story_conversation")
        .select("id")
        .eq("id", session_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybe_single()
        .execute()
    )
    if not existing or not existing.data:
        raise HTTPException(404, "Active conversation not found")

    db.table("story_conversation").update({
        "status": "abandoned",
    }).eq("id", session_id).execute()
    return {"status": "abandoned", "id": session_id}


# ── Version endpoints ──

@router.get("/{story_id}/versions")
async def list_versions(
    story_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """List all versions for a story."""
    db = get_supabase()

    # Verify ownership
    story = (
        db.table("story").select("id").eq("id", story_id).eq("user_id", user.id).maybe_single().execute()
    )
    if not story or not story.data:
        raise HTTPException(404, "Story not found")

    resp = (
        db.table("story_version")
        .select("id, version_num, fields, change_summary, created_at, session_id")
        .eq("story_id", story_id)
        .order("version_num", desc=True)
        .execute()
    )
    return {"versions": resp.data or []}


@router.get("/{story_id}/versions/{version_num}")
async def get_version(
    story_id: str,
    version_num: int,
    user: AuthUser = Depends(get_current_user),
):
    """Get a specific version snapshot."""
    db = get_supabase()

    resp = (
        db.table("story_version")
        .select("*")
        .eq("story_id", story_id)
        .eq("version_num", version_num)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(404, "Version not found")
    return resp.data


# ── AI coaching endpoints ──

@router.post("/{story_id}/improve")
async def improve_story(
    story_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """AI-assisted story improvement."""
    db = get_supabase()

    story_resp = (
        db.table("story")
        .select("*")
        .eq("id", story_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not story_resp or not story_resp.data:
        raise HTTPException(404, "Story not found")

    user_context = await coach.build_user_context(user.id)
    result = await story_coach.improve_story(story_resp.data, user_context)
    return {"story_id": story_id, "improvements": result}


@router.get("/gaps")
async def get_story_gaps(
    user: AuthUser = Depends(get_current_user),
    workspace_id: Optional[str] = Query(None),
):
    """Context-aware gap analysis. Pass workspace_id for JD-prioritized gaps."""
    db = get_supabase()
    stories_resp = (
        db.table("story")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .execute()
    )
    stories = stories_resp.data or []

    # If no stories, return basic coverage with universal categories
    if not stories:
        from backend.api.services.story_coach import UNIVERSAL_CATEGORIES
        return {
            "mode": "universal",
            "coverage_score": 0,
            "mapped_stories": [],
            "gaps": [
                {"competency": cat, "severity": "important", "reason": "No stories yet",
                 "handling_pattern": "build_new", "recommendation": f"Build a {cat} story",
                 "closest_story": None}
                for cat in UNIVERSAL_CATEGORIES
            ],
            "concentration_risk": None,
        }

    # Fetch workspace if provided
    workspace = None
    if workspace_id:
        try:
            ws_resp = (
                db.table("job_workspace")
                .select("*")
                .eq("id", workspace_id)
                .eq("user_id", user.id)
                .maybe_single()
                .execute()
            )
            workspace = ws_resp.data if ws_resp else None
        except Exception:
            pass

    user_context = await coach.build_user_context(user.id, workspace_id=workspace_id)
    result = await story_coach.analyze_gaps(stories, user_context, workspace=workspace)
    result["mode"] = "workspace" if workspace else "universal"
    return result


@router.get("/narrative")
async def get_narrative(
    user: AuthUser = Depends(get_current_user),
):
    """Narrative identity analysis across the storybank."""
    db = get_supabase()
    stories_resp = (
        db.table("story")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .execute()
    )
    stories = stories_resp.data or []

    if len(stories) < 3:
        raise HTTPException(400, "Need at least 3 stories for narrative analysis")

    user_context = await coach.build_user_context(user.id)
    result = await story_coach.narrative_analysis(stories, user_context)
    return {"narrative": result}


@router.post("/discover")
async def discover_stories(
    req: DiscoverRequest,
    user: AuthUser = Depends(get_current_user),
):
    """AI-guided story discovery."""
    user_context = await coach.build_user_context(user.id)
    result = await story_coach.discover_stories(user_context, req.prompt)
    return result


@router.post("/chat")
async def story_chat(req: StoryChatRequest, user: AuthUser = Depends(get_current_user)):
    """Stream a story coaching conversation via SSE.

    When session_id is provided:
    - Messages are persisted to the session after each exchange
    - On STORY_EXTRACT: story is updated/created, version snapshot saved, session completed
    """
    db = get_supabase()
    user_context = await coach.build_user_context(user.id)

    async def event_stream():
        full_response = ""
        MARKER = "|||STORY_EXTRACT|||"
        emit_buffer = ""  # Buffer to hold tokens that might be start of marker
        extraction_started = False

        async for token in coach.coach_stream("story_chat", user_context, req.messages):
            full_response += token

            if extraction_started:
                continue

            emit_buffer += token

            # Check if the buffer contains the full marker
            if MARKER in emit_buffer:
                # Emit everything before the marker, then stop emitting
                before_marker = emit_buffer.split(MARKER)[0]
                if before_marker:
                    yield f"event: token\ndata: {json_mod.dumps({'text': before_marker})}\n\n"
                extraction_started = True
                continue

            # Check if the end of the buffer could be the start of the marker
            # (i.e., the marker starts with what's at the tail of the buffer)
            might_be_marker = False
            for i in range(1, min(len(MARKER), len(emit_buffer)) + 1):
                if MARKER.startswith(emit_buffer[-i:]):
                    might_be_marker = True
                    break

            if not might_be_marker:
                # Safe to emit the entire buffer
                yield f"event: token\ndata: {json_mod.dumps({'text': emit_buffer})}\n\n"
                emit_buffer = ""

        # Flush any remaining buffer (if no extraction happened)
        if emit_buffer and not extraction_started:
            yield f"event: token\ndata: {json_mod.dumps({'text': emit_buffer})}\n\n"

        # Persist messages to session if session_id provided
        if req.session_id:
            try:
                # Build the messages array to persist (chat messages in our format)
                # Convert API messages back to our format for storage
                stored_messages = []
                for m in req.messages:
                    stored_messages.append({
                        "role": "coach" if m.get("role") == "assistant" else "user",
                        "text": m.get("content", ""),
                    })
                # Add the coach response
                # Strip the extraction block from the stored response
                visible_response = full_response
                if "|||STORY_EXTRACT" in visible_response:
                    visible_response = visible_response.split("|||STORY_EXTRACT")[0].strip()
                if visible_response:
                    stored_messages.append({"role": "coach", "text": visible_response})

                db.table("story_conversation").update({
                    "messages": stored_messages,
                    "updated_at": "now()",
                }).eq("id", req.session_id).execute()
            except Exception:
                pass  # Don't fail the stream if persistence fails

        # After stream completes, check for extraction
        story_data = None
        if "|||STORY_EXTRACT|||" in full_response and "|||END_EXTRACT|||" in full_response:
            json_str = full_response.split("|||STORY_EXTRACT|||")[1].split("|||END_EXTRACT|||")[0].strip()
            try:
                story_data = json_mod.loads(json_str)
                yield f"event: story_complete\ndata: {json_mod.dumps(story_data)}\n\n"
            except json_mod.JSONDecodeError:
                story_data = None

        # If extraction happened and we have a session, auto-save version
        if story_data and req.session_id:
            try:
                change_summary = story_data.pop("changeSummary", None)

                # Map camelCase to snake_case for DB
                db_fields = {
                    "title": story_data.get("title"),
                    "situation": story_data.get("situation"),
                    "task": story_data.get("task"),
                    "action": story_data.get("action"),
                    "result": story_data.get("result"),
                    "primary_skill": story_data.get("primarySkill"),
                    "secondary_skill": story_data.get("secondarySkill"),
                    "earned_secret": story_data.get("earnedSecret"),
                    "strength": story_data.get("strength"),
                    "domain": story_data.get("domain"),
                    "deploy_for": story_data.get("deployFor"),
                }
                # Remove None values
                db_fields = {k: v for k, v in db_fields.items() if v is not None}

                # Get session to find story_id
                session = (
                    db.table("story_conversation")
                    .select("story_id")
                    .eq("id", req.session_id)
                    .maybe_single()
                    .execute()
                )
                session_story_id = session.data["story_id"] if session and session.data else None

                if session_story_id:
                    # Update existing story
                    db.table("story").update(db_fields).eq("id", session_story_id).execute()
                    story_id = session_story_id
                else:
                    # Create new story
                    db_fields["user_id"] = user.id
                    resp = db.table("story").insert(db_fields).execute()
                    story_id = resp.data[0]["id"]
                    # Link session to new story
                    db.table("story_conversation").update({
                        "story_id": story_id,
                    }).eq("id", req.session_id).execute()

                # Create version snapshot
                version_num = _create_version(
                    db,
                    story_id=story_id,
                    fields=db_fields,
                    session_id=req.session_id,
                    change_summary=change_summary,
                )

                # Mark session as completed
                db.table("story_conversation").update({
                    "status": "completed",
                }).eq("id", req.session_id).execute()

                # Send version info to frontend
                yield f"event: version_created\ndata: {json_mod.dumps({'story_id': story_id, 'version_num': version_num, 'change_summary': change_summary})}\n\n"

            except Exception:
                pass  # Don't fail the stream if version creation fails

        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
