"""Materials API — resume, pitch, LinkedIn, salary coaching."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.ai_coach import AICoachService
from backend.api.services.resume_service import ResumeService
from backend.api.services.pitch_service import PitchService

router = APIRouter(prefix="/api/materials", tags=["materials"])
coach = AICoachService()
resume_service = ResumeService()
pitch_service = PitchService()


# --- Resume ---

@router.post("/resume/upload")
async def upload_resume(
    user: AuthUser = Depends(get_current_user),
    file: UploadFile = File(...),
    resume_text: Optional[str] = Form(None),
):
    """Upload resume to Supabase Storage + run AI analysis.

    Accepts a file upload and optionally pre-extracted text.
    If resume_text is not provided, the file content is read as text.
    """
    db = get_supabase()

    # Upload to Supabase Storage
    content = await file.read()
    storage_path = f"resumes/{user.id}/{file.filename}"
    db.storage.from_("materials").upload(storage_path, content, {"content-type": file.content_type})
    file_url = f"{db.supabase_url}/storage/v1/object/public/materials/{storage_path}"

    # Use provided text or decode file content
    text = resume_text or content.decode("utf-8", errors="ignore")

    # AI analysis
    user_context = await coach.build_user_context(user.id)
    analysis = await resume_service.analyze_resume(text, user_context)
    saved = await resume_service.save_analysis(user.id, analysis, resume_url=file_url)

    return {"analysis": saved, "file_url": file_url}


@router.get("/resume")
async def get_resume_analysis(
    user: AuthUser = Depends(get_current_user),
):
    """Get stored resume analysis."""
    db = get_supabase()
    resp = (
        db.table("resume_analysis")
        .select("*")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(404, "No resume analysis found. Upload a resume first.")
    return resp.data


@router.post("/resume/optimize")
async def optimize_resume(
    user: AuthUser = Depends(get_current_user),
):
    """AI optimization suggestions for the current resume."""
    user_context = await coach.build_user_context(user.id)
    result = await resume_service.optimize_resume(user_context)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return {"optimizations": result}


# --- Pitch / Positioning ---

@router.get("/pitch")
async def get_pitch(
    user: AuthUser = Depends(get_current_user),
):
    """Get stored positioning statement."""
    db = get_supabase()
    resp = (
        db.table("positioning_statement")
        .select("*")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(404, "No positioning statement found. Generate one first.")
    return resp.data


@router.post("/pitch/generate")
async def generate_pitch(
    user: AuthUser = Depends(get_current_user),
):
    """AI-generated positioning statement."""
    user_context = await coach.build_user_context(user.id)
    pitch = await pitch_service.generate_pitch(user_context)
    saved = await pitch_service.save_pitch(user.id, pitch)
    return {"pitch": saved}


# --- LinkedIn ---

class LinkedInAuditRequest(BaseModel):
    linkedin_text: str


@router.get("/linkedin")
async def get_linkedin(
    user: AuthUser = Depends(get_current_user),
):
    """Get stored LinkedIn analysis."""
    db = get_supabase()
    resp = (
        db.table("linkedin_analysis")
        .select("*")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(404, "No LinkedIn analysis found. Run an audit first.")
    return resp.data


@router.post("/linkedin/audit")
async def audit_linkedin(
    req: LinkedInAuditRequest,
    user: AuthUser = Depends(get_current_user),
):
    """AI LinkedIn profile audit."""
    user_context = await coach.build_user_context(user.id)
    analysis = await pitch_service.audit_linkedin(req.linkedin_text, user_context)
    saved = await pitch_service.save_linkedin(user.id, analysis)
    return {"analysis": saved}


# --- Salary / Comp ---

class CompRequest(BaseModel):
    target_range: Optional[str] = None
    current_comp: Optional[str] = None
    location: Optional[str] = None
    stage: Optional[str] = None


@router.get("/salary")
async def get_comp_strategy(
    user: AuthUser = Depends(get_current_user),
):
    """Get stored compensation strategy."""
    db = get_supabase()
    resp = (
        db.table("comp_strategy")
        .select("*")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(404, "No comp strategy found. Build one first.")
    return resp.data


@router.post("/salary/build")
async def build_comp_strategy(
    req: CompRequest,
    user: AuthUser = Depends(get_current_user),
):
    """AI-powered compensation strategy."""
    user_context = await coach.build_user_context(user.id)
    strategy = await pitch_service.build_comp_strategy(req.model_dump(), user_context)
    saved = await pitch_service.save_comp(user.id, strategy)
    return {"strategy": saved}
