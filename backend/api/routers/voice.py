"""Voice endpoints — ElevenLabs ConvAI signed URL."""
from fastapi import APIRouter, Depends
from backend.api.auth import AuthUser, get_current_user
from backend.api.services.voice_service import get_signed_url as _get_signed_url
from backend.config import settings

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.get("/signed-url")
async def signed_url(user: AuthUser = Depends(get_current_user)):
    """Return a signed URL for the ElevenLabs ConvAI WebSocket."""
    url = await _get_signed_url()
    return {"signed_url": url}


@router.get("/story-signed-url")
async def story_signed_url(user: AuthUser = Depends(get_current_user)):
    """Return a signed URL for the ElevenLabs story-builder agent."""
    url = await _get_signed_url(agent_id=settings.ELEVENLABS_STORY_AGENT_ID or None)
    return {"signed_url": url}
