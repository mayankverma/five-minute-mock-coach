"""Auth and profile endpoints."""
from fastapi import APIRouter, Depends
from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.models.user import ProfileCreate, ProfileResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me")
async def get_me(user: AuthUser = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    db = get_supabase()
    result = (
        db.table("user_profile")
        .select("*")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        return {"user_id": user.id, "email": user.email, "has_profile": False}
    return {**result.data, "email": user.email, "has_profile": True}


@router.post("/profile", response_model=ProfileResponse)
async def upsert_profile(
    profile: ProfileCreate,
    user: AuthUser = Depends(get_current_user),
):
    """Create or update the user's coaching profile."""
    db = get_supabase()
    data = {"user_id": user.id, **profile.model_dump(exclude_none=True)}

    result = db.table("user_profile").upsert(data, on_conflict="user_id").execute()
    return result.data[0]
