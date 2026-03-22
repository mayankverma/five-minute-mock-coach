"""Supabase JWT authentication dependency for FastAPI."""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel
from backend.config import settings
from backend.api.db.client import get_supabase
import httpx

security = HTTPBearer(auto_error=False)

# Cache for JWKS public keys
_jwks_cache: dict | None = None


class AuthUser(BaseModel):
    id: str
    email: Optional[str] = None


async def _get_jwks() -> dict:
    """Fetch Supabase JWKS (cached)."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json")
        r.raise_for_status()
        _jwks_cache = r.json()
        return _jwks_cache


def _decode_hs256(token: str) -> dict | None:
    """Try decoding with HS256 (legacy Supabase projects)."""
    try:
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError:
        return None


async def _decode_es256(token: str) -> dict | None:
    """Try decoding with ES256 using JWKS (new Supabase projects)."""
    try:
        jwks = await _get_jwks()
        # Get the signing key from JWKS
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        key = None
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key = k
                break
        if not key:
            return None
        return jwt.decode(
            token,
            key,
            algorithms=["ES256"],
            audience="authenticated",
        )
    except (JWTError, Exception):
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> AuthUser:
    """Validate Supabase JWT and return the authenticated user."""
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing authorization header")

    token = credentials.credentials

    # Try HS256 first (fast, no network), then ES256 with JWKS
    payload = _decode_hs256(token)
    if payload is None:
        payload = await _decode_es256(token)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing subject")

    return AuthUser(id=user_id, email=payload.get("email"))


async def check_workspace_limit(user_id: str) -> None:
    """Raise 403 if a free-tier user already has 1 job workspace."""
    db = get_supabase()
    profile = (
        db.table("user_profile")
        .select("subscription_tier")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    tier = profile.data.get("subscription_tier", "free") if profile.data else "free"

    if tier == "free":
        count_resp = (
            db.table("job_workspace")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .neq("status", "archived")
            .execute()
        )
        if count_resp.count and count_resp.count >= 1:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Free plan allows 1 job workspace. Upgrade to Premium for unlimited.",
            )
