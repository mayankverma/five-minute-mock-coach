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
    """Create a new story."""
    db = get_supabase()
    data = {"user_id": user.id, **story.model_dump(exclude_none=True)}
    resp = db.table("story").insert(data).execute()
    return resp.data[0]


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
    if not existing.data:
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
    if not existing.data:
        raise HTTPException(404, "Story not found")

    db.table("story").update({"status": "retired"}).eq("id", story_id).execute()
    return {"status": "retired", "id": story_id}


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
    if not story_resp.data:
        raise HTTPException(404, "Story not found")

    user_context = await coach.build_user_context(user.id)
    result = await story_coach.improve_story(story_resp.data, user_context)
    return {"story_id": story_id, "improvements": result}


@router.get("/gaps")
async def get_story_gaps(
    user: AuthUser = Depends(get_current_user),
):
    """Identify missing story types based on target roles."""
    db = get_supabase()
    stories_resp = (
        db.table("story")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .execute()
    )
    stories = stories_resp.data or []

    if not stories:
        return {
            "gaps": {
                "missing_categories": [
                    "leadership", "conflict", "failure", "achievement",
                    "innovation", "teamwork", "growth", "customer",
                ],
                "recommendations": ["Start by adding your strongest career story."],
                "coverage_score": 0,
            }
        }

    user_context = await coach.build_user_context(user.id)
    result = await story_coach.analyze_gaps(stories, user_context)
    return {"gaps": result}


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
