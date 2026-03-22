"""User-related Pydantic models."""
from typing import Optional
from pydantic import BaseModel


class ProfileCreate(BaseModel):
    full_name: Optional[str] = None
    target_roles: list[str] = []
    seniority_band: Optional[str] = None
    track: str = "full"
    feedback_directness: int = 3
    interview_timeline: Optional[str] = None
    coaching_mode: str = "full"
    interview_history: Optional[str] = None
    biggest_concern: Optional[str] = None


class ProfileResponse(BaseModel):
    id: str
    user_id: str
    full_name: Optional[str] = None
    target_roles: list[str] = []
    seniority_band: Optional[str] = None
    track: str = "full"
    feedback_directness: int = 3
    interview_timeline: Optional[str] = None
    coaching_mode: str = "full"
    interview_history: Optional[str] = None
    biggest_concern: Optional[str] = None
    anxiety_profile: Optional[str] = None
    career_transition: str = "none"
    subscription_tier: str = "free"
