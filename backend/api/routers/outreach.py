"""Outreach API — conversation CRUD + coach chat."""

import json as json_mod
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.ai_coach import AICoachService

router = APIRouter(prefix="/api/outreach", tags=["outreach"])
coach = AICoachService()

MESSAGE_TYPE_LABELS = {
    "cold_linkedin": "Cold LinkedIn Connection",
    "cold_email": "Cold Email",
    "warm_intro": "Warm Intro Request",
    "informational": "Informational Interview Ask",
    "recruiter_reply": "Recruiter Reply",
    "follow_up": "Follow-Up",
    "post_meeting": "Post-Meeting Follow-Up",
    "referral": "Referral Request",
}


class ConversationCreate(BaseModel):
    message_type: str

class ConversationUpdate(BaseModel):
    title: Optional[str] = None

class ChatRequest(BaseModel):
    messages: list[dict]


@router.post("/conversations")
async def create_conversation(
    req: ConversationCreate,
    user: AuthUser = Depends(get_current_user),
):
    """Create a new outreach conversation."""
    db = get_supabase()
    label = MESSAGE_TYPE_LABELS.get(req.message_type, req.message_type)
    from datetime import datetime
    title = f"{label} — {datetime.now().strftime('%-m/%d')}"

    resp = db.table("outreach_conversation").insert({
        "user_id": user.id,
        "title": title,
        "message_type": req.message_type,
        "messages": [],
    }).execute()
    return resp.data[0]


@router.get("/conversations")
async def list_conversations(
    user: AuthUser = Depends(get_current_user),
):
    """List all outreach conversations (metadata only)."""
    db = get_supabase()
    resp = (
        db.table("outreach_conversation")
        .select("id,title,message_type,created_at,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", desc=True)
        .execute()
    )
    return resp.data or []


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Get a conversation with full messages."""
    db = get_supabase()
    resp = (
        db.table("outreach_conversation")
        .select("*")
        .eq("id", conversation_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(404, "Conversation not found")
    return resp.data


@router.put("/conversations/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    req: ConversationUpdate,
    user: AuthUser = Depends(get_current_user),
):
    """Rename a conversation."""
    db = get_supabase()
    update_data = {}
    if req.title is not None:
        update_data["title"] = req.title
    if not update_data:
        raise HTTPException(400, "Nothing to update")

    resp = (
        db.table("outreach_conversation")
        .update(update_data)
        .eq("id", conversation_id)
        .eq("user_id", user.id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(404, "Conversation not found")
    return resp.data[0]


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Delete a conversation."""
    db = get_supabase()
    db.table("outreach_conversation").delete().eq("id", conversation_id).eq("user_id", user.id).execute()
    return {"deleted": True}


@router.post("/conversations/{conversation_id}/chat")
async def outreach_chat(
    conversation_id: str,
    req: ChatRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Stream outreach coaching conversation via SSE."""
    db = get_supabase()

    # Verify ownership and get conversation
    conv = (
        db.table("outreach_conversation")
        .select("*")
        .eq("id", conversation_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not conv or not conv.data:
        raise HTTPException(404, "Conversation not found")

    message_type = conv.data.get("message_type", "")
    user_context = await coach.build_user_context(user.id)

    # Build chat messages with context
    chat_messages = [
        {"role": m.get("role", "user"), "content": m.get("content", "")}
        for m in req.messages
    ]

    async def event_stream():
        full_response = ""
        async for token in coach.coach_stream("outreach_chat", user_context, chat_messages):
            full_response += token
            yield f"event: token\ndata: {json_mod.dumps({'text': token})}\n\n"

        # Persist messages after streaming completes
        stored_messages = conv.data.get("messages", [])
        # Add user message
        if req.messages:
            last_user = req.messages[-1]
            if last_user.get("role") == "user":
                stored_messages.append({"role": "user", "text": last_user.get("content", "")})
        # Add coach response
        if full_response:
            stored_messages.append({"role": "coach", "text": full_response})

        db.table("outreach_conversation").update({
            "messages": stored_messages,
            "updated_at": "now()",
        }).eq("id", conversation_id).execute()

        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
