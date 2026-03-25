"""Materials API — resume, pitch, LinkedIn, salary coaching."""

import io
import json as json_mod
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.ai_coach import AICoachService
from backend.api.services.resume_service import ResumeService
from backend.api.services.pitch_service import PitchService

logger = logging.getLogger(__name__)

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
    try:
        resp = (
            db.table("resume_analysis")
            .select("*")
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(404, "No resume analysis found. Upload a resume first.")
    if not resp or not resp.data:
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
    try:
        resp = (
            db.table("positioning_statement")
            .select("*")
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(404, "No positioning statement found. Generate one first.")
    if not resp or not resp.data:
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


def _extract_pdf_text(content: bytes) -> str:
    """Extract text from PDF bytes using pymupdf."""
    try:
        import pymupdf
        doc = pymupdf.open(stream=content, filetype="pdf")
        pages = [page.get_text() for page in doc]
        doc.close()
        return "\n".join(pages)
    except Exception as e:
        logger.warning(f"PDF extraction failed, falling back to raw decode: {e}")
        return content.decode("utf-8", errors="ignore")


@router.get("/linkedin")
async def get_linkedin(
    user: AuthUser = Depends(get_current_user),
):
    """Get stored LinkedIn analysis. Returns None when no analysis exists."""
    db = get_supabase()
    try:
        resp = (
            db.table("linkedin_analysis")
            .select("*")
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
    except Exception:
        return None
    if not resp or not resp.data:
        return None
    return resp.data


@router.post("/linkedin/audit")
async def audit_linkedin(
    user: AuthUser = Depends(get_current_user),
    linkedin_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """AI LinkedIn profile audit — accepts PDF upload or pasted text."""
    profile_text = ""
    source = "text"

    if file and file.filename:
        content = await file.read()
        if file.content_type == "application/pdf" or (file.filename and file.filename.lower().endswith(".pdf")):
            profile_text = _extract_pdf_text(content)
            source = "pdf"
        else:
            profile_text = content.decode("utf-8", errors="ignore")
            source = "text"
    elif linkedin_text:
        profile_text = linkedin_text
        source = "text"
    else:
        raise HTTPException(400, "Provide either linkedin_text or a file upload.")

    if not profile_text.strip():
        raise HTTPException(400, "Could not extract any text from the provided input.")

    user_context = await coach.build_user_context(user.id)
    analysis = await pitch_service.audit_linkedin(profile_text, user_context)
    saved = await pitch_service.save_linkedin(user.id, analysis, profile_text=profile_text, source=source)
    return {"analysis": saved}


class LinkedInChatRequest(BaseModel):
    messages: list[dict]


@router.post("/linkedin/chat")
async def linkedin_chat(
    req: LinkedInChatRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Coach chat for LinkedIn profile improvement — SSE streaming."""
    db = get_supabase()

    # Load existing linkedin analysis for context
    analysis_text = ""
    try:
        resp = (
            db.table("linkedin_analysis")
            .select("*")
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        if resp and resp.data:
            a = resp.data
            analysis_text = (
                f"\nProfile text: {(a.get('profile_text') or '')[:3000]}\n"
                f"Overall: {a.get('overall')}\n"
                f"Top fixes: {json_mod.dumps(a.get('top_fixes', []))}"
            )
    except Exception:
        pass

    user_context = await coach.build_user_context(user.id)

    # Inject audit context as the first message
    context_msg = {
        "role": "user",
        "content": (
            f"[CONTEXT — LinkedIn audit results:{analysis_text}]\n\n"
            f"Help me improve my LinkedIn profile based on the audit above."
        ),
    }

    chat_messages = [context_msg] + [
        {"role": m.get("role", "user"), "content": m.get("content", "")}
        for m in req.messages
    ]

    async def event_stream():
        full_response = ""
        async for token in coach.coach_stream("linkedin_chat", user_context, chat_messages):
            full_response += token
            yield f"event: token\ndata: {json_mod.dumps({'text': token})}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


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
    try:
        resp = (
            db.table("comp_strategy")
            .select("*")
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(404, "No comp strategy found. Build one first.")
    if not resp or not resp.data:
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
