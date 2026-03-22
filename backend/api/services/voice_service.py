"""ElevenLabs ConvAI voice service."""
import httpx
from fastapi import HTTPException, status
from backend.config import settings

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"


async def get_signed_url() -> str:
    """Get a signed URL for starting an ElevenLabs ConvAI conversation.

    Returns the signed WebSocket URL for the frontend to connect to.
    """
    if not settings.ELEVENLABS_API_KEY:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "ElevenLabs not configured")
    if not settings.ELEVENLABS_AGENT_ID:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "ElevenLabs agent not configured")

    url = f"{ELEVENLABS_BASE}/convai/conversation/get-signed-url"
    headers = {"xi-api-key": settings.ELEVENLABS_API_KEY}
    params = {"agent_id": settings.ELEVENLABS_AGENT_ID}

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(url, headers=headers, params=params)

        if resp.status_code == 401:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "ElevenLabs: invalid API key")
        if resp.status_code == 429:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "ElevenLabs rate limit exceeded")
        if resp.status_code == 404:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "ElevenLabs agent not found")

        resp.raise_for_status()
        data = resp.json()

        if "signed_url" not in data:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "ElevenLabs: unexpected response format")

        return data["signed_url"]
