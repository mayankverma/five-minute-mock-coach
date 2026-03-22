"""Voice endpoints — ElevenLabs ConvAI signed URL."""
from fastapi import APIRouter, Depends
from backend.api.auth import AuthUser, get_current_user
from backend.api.services.voice_service import get_signed_url as _get_signed_url

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.get("/signed-url")
async def signed_url(user: AuthUser = Depends(get_current_user)):
    """Return a signed URL for the ElevenLabs ConvAI WebSocket."""
    url = await _get_signed_url()
    return {"signed_url": url}
