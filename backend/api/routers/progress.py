"""Scoring + progress API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.progress_analyzer import ProgressAnalyzer
from backend.api.services.pattern_detection import PatternDetectionService
from backend.api.services.calibration_engine import CalibrationEngine

router = APIRouter(prefix="/api/progress", tags=["progress"])
analyzer = ProgressAnalyzer()
pattern_service = PatternDetectionService()
calibration_engine = CalibrationEngine()


@router.get("")
async def get_progress(
    user: AuthUser = Depends(get_current_user),
    workspace_id: Optional[str] = Query(None),
):
    """Full progress report — trends, calibration, patterns, drill stage."""
    report = await analyzer.full_report(user.id, workspace_id)
    return report


@router.get("/scores")
async def get_scores(
    user: AuthUser = Depends(get_current_user),
    workspace_id: Optional[str] = Query(None),
    entry_type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """Score history, filterable by workspace and type."""
    db = get_supabase()
    query = (
        db.table("score_entry")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if workspace_id:
        query = query.eq("workspace_id", workspace_id)
    if entry_type:
        query = query.eq("entry_type", entry_type)

    resp = query.execute()
    return {"scores": resp.data or [], "count": len(resp.data or [])}


@router.get("/patterns")
async def get_patterns(
    user: AuthUser = Depends(get_current_user),
):
    """Effective and ineffective interview patterns."""
    result = await pattern_service.detect_patterns(user.id)
    return result


@router.get("/calibration")
async def get_calibration(
    user: AuthUser = Depends(get_current_user),
):
    """Self-assessment accuracy analysis."""
    result = await calibration_engine.get_calibration(user.id)
    return result


class FeedbackCreate(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    round: Optional[str] = None
    result: Optional[str] = None
    feedback_text: Optional[str] = None
    source: Optional[str] = None
    linked_dimension: Optional[str] = None
    notes: Optional[str] = None


@router.post("/feedback")
async def submit_feedback(
    feedback: FeedbackCreate,
    user: AuthUser = Depends(get_current_user),
):
    """Capture recruiter feedback, outcomes, or corrections."""
    db = get_supabase()
    saved = {}

    # Save recruiter feedback if provided
    if feedback.feedback_text:
        fb_data = {
            "user_id": user.id,
            "company": feedback.company,
            "source": feedback.source or "recruiter",
            "feedback_text": feedback.feedback_text,
            "linked_dimension": feedback.linked_dimension,
        }
        resp = db.table("recruiter_feedback").insert(fb_data).execute()
        saved["feedback"] = resp.data[0]

    # Save outcome if result provided
    if feedback.result:
        outcome_data = {
            "user_id": user.id,
            "company": feedback.company or "Unknown",
            "role": feedback.role,
            "round": feedback.round,
            "result": feedback.result,
            "notes": feedback.notes,
        }
        resp = db.table("outcome_log").insert(outcome_data).execute()
        saved["outcome"] = resp.data[0]

    if not saved:
        return {"message": "No feedback or outcome data provided"}

    return saved
