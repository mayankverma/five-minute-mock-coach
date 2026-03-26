"""Resume API — upload, parse, analyze, section CRUD, coach chat."""

import io
import json as json_mod
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)
from pydantic import BaseModel
from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.ai_coach import AICoachService
from backend.api.services.resume_service import ResumeService
from backend.api.services.resume_parser import ResumeParser
from backend.api.services.question_generator import QuestionGenerator

router = APIRouter(prefix="/api/resume", tags=["resume"])
coach = AICoachService()
resume_service = ResumeService()
resume_parser = ResumeParser()
question_generator = QuestionGenerator()


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


# --- Upload + Analyze ---

@router.post("/upload")
async def upload_resume(
    user: AuthUser = Depends(get_current_user),
    file: UploadFile = File(...),
    resume_text: Optional[str] = Form(None),
    job_id: Optional[str] = Form(None),
):
    """Upload resume file, parse into sections, and run AI analysis."""
    try:
        return await _do_upload(user, file, resume_text, job_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Resume upload failed")
        raise HTTPException(500, f"Upload failed: {e}")

async def _do_upload(user, file, resume_text, job_id):
    db = get_supabase()

    content = await file.read()

    # Extract text from file
    if resume_text:
        text = resume_text
    elif file.filename and file.filename.lower().endswith(".pdf"):
        text = _extract_pdf_text(content)
    else:
        text = content.decode("utf-8", errors="ignore")

    # Strip null bytes — Postgres TEXT columns cannot store \u0000
    text = text.replace("\x00", "")

    # Upsert resume record
    resume_data = {
        "user_id": user.id,
        "name": "Master Resume" if not job_id else "Resume for Job",
        "original_file_name": file.filename,
        "raw_text": text,
        "updated_at": "now()",
    }
    if job_id:
        resume_data["job_id"] = job_id

    # Check if resume exists
    query = db.table("resume").select("id").eq("user_id", user.id)
    if job_id:
        query = query.eq("job_id", job_id)
    else:
        query = query.is_("job_id", "null")
    existing = query.maybe_single().execute()

    if existing and existing.data:
        resume_id = existing.data["id"]
        db.table("resume").update(resume_data).eq("id", resume_id).execute()
        db.table("resume_section").delete().eq("resume_id", resume_id).execute()
        db.table("resume_analysis_v2").delete().eq("resume_id", resume_id).execute()
    else:
        resp = db.table("resume").insert(resume_data).execute()
        resume_id = resp.data[0]["id"]

    user_context = await coach.build_user_context(user.id)

    # Parse sections
    sections = await resume_parser.parse_sections(text, user_context)
    for section in sections:
        db.table("resume_section").insert({
            "resume_id": resume_id,
            "section_type": section["section_type"],
            "sort_order": section.get("sort_order", 0),
            "content": section["content"],
        }).execute()

    # Run analysis (non-fatal — upload succeeds even if analysis fails)
    analysis_data = await _run_analysis(db, resume_id, text, user_context, user.id)

    return {"resume_id": resume_id, "analysis": analysis_data, "sections_count": len(sections)}


async def _run_analysis(db, resume_id: str, text: str, user_context: dict, user_id: str) -> dict | None:
    """Run AI analysis and save to DB. Returns analysis_data or None on failure."""
    try:
        analysis = await resume_service.analyze_resume(text, user_context)

        analysis_data = {
            "resume_id": resume_id,
            "depth_level": "standard",
            "overall_grade": analysis.get("overall_grade") or analysis.get("overall", "N/A"),
            "ats_compatibility": analysis.get("ats_compatibility"),
            "recruiter_scan": analysis.get("recruiter_scan"),
            "bullet_quality": analysis.get("bullet_quality"),
            "seniority_calibration": analysis.get("seniority_calibration"),
            "keyword_coverage": analysis.get("keyword_coverage"),
            "structure_layout": analysis.get("structure_layout"),
            "consistency_polish": analysis.get("consistency_polish"),
            "concern_management": analysis.get("concern_management"),
            "top_fixes": analysis.get("top_fixes", []),
            "concern_mitigations": analysis.get("concern_mitigations", []),
            "positioning_strengths": analysis.get("positioning_strengths"),
            "likely_concerns": analysis.get("likely_concerns"),
            "career_narrative_gaps": analysis.get("career_narrative_gaps"),
            "story_seeds": analysis.get("story_seeds", []),
            "cross_surface_gaps": analysis.get("cross_surface_gaps", []),
        }
        # Clear previous analysis
        db.table("resume_analysis_v2").delete().eq("resume_id", resume_id).execute()
        db.table("resume_analysis_v2").insert(analysis_data).execute()

        # Auto-generate gap questions from career narrative gaps
        gaps = analysis.get("career_narrative_gaps") or []
        if gaps and isinstance(gaps, list):
            try:
                await question_generator.generate_gap_questions(
                    user_id=user_id,
                    gaps=[str(g) for g in gaps],
                    user_context=user_context,
                    resume_analysis_id=None,
                )
            except Exception:
                pass  # Don't fail upload if gap question generation fails

        # Also save to legacy resume_analysis for backward compat
        try:
            await resume_service.save_analysis(user_id, analysis)
        except Exception as e:
            print(f"[WARN] Legacy analysis save failed: {e}")

        return analysis_data
    except Exception as e:
        import traceback
        print(f"[ERROR] Resume analysis failed: {e}")
        traceback.print_exc()
        return None


# --- Analyze (manual trigger) ---

@router.post("/{resume_id}/analyze")
async def analyze_resume(
    resume_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Run AI analysis on an existing resume. Can be triggered manually."""
    db = get_supabase()

    resume = db.table("resume").select("*").eq("id", resume_id).maybe_single().execute()
    if not resume or not resume.data:
        raise HTTPException(404, "Resume not found")
    if resume.data["user_id"] != user.id:
        raise HTTPException(403, "Not authorized")

    text = resume.data.get("raw_text", "")
    if not text:
        raise HTTPException(400, "Resume has no text content to analyze")

    user_context = await coach.build_user_context(user.id)
    analysis_data = await _run_analysis(db, resume_id, text, user_context, user.id)

    if not analysis_data:
        raise HTTPException(500, "Analysis failed — check server logs")

    return {"analysis": analysis_data}


# --- Read Resume (with sections + analysis) ---

@router.get("")
async def get_resume(
    user: AuthUser = Depends(get_current_user),
    job_id: Optional[str] = None,
):
    """Get the active resume for the current workspace context."""
    db = get_supabase()

    query = db.table("resume").select("*").eq("user_id", user.id)
    if job_id:
        query = query.eq("job_id", job_id)
    else:
        query = query.is_("job_id", "null")
    resume_resp = query.maybe_single().execute()

    # Fallback to master if job-specific not found
    if (not resume_resp or not resume_resp.data) and job_id:
        resume_resp = (
            db.table("resume").select("*")
            .eq("user_id", user.id)
            .is_("job_id", "null")
            .maybe_single().execute()
        )

    if not resume_resp or not resume_resp.data:
        return {"resume": None, "sections": [], "analysis": None}

    resume = resume_resp.data
    resume_id = resume["id"]

    sections_resp = (
        db.table("resume_section").select("*")
        .eq("resume_id", resume_id)
        .order("sort_order")
        .execute()
    )
    sections = sections_resp.data or []

    analysis_resp = (
        db.table("resume_analysis_v2").select("*")
        .eq("resume_id", resume_id)
        .maybe_single().execute()
    )
    analysis = analysis_resp.data if analysis_resp else None

    return {"resume": resume, "sections": sections, "analysis": analysis}


# --- Delete Resume ---

@router.delete("/{resume_id}")
async def delete_resume(
    resume_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Delete a resume and all related data (sections, analysis, coach sessions).

    Child tables use ON DELETE CASCADE so deleting the resume row clears everything.
    Also clears the legacy resume_analysis row for this user.
    """
    db = get_supabase()

    resume = db.table("resume").select("user_id").eq("id", resume_id).maybe_single().execute()
    if not resume or not resume.data:
        raise HTTPException(404, "Resume not found")
    if resume.data["user_id"] != user.id:
        raise HTTPException(403, "Not authorized")

    db.table("resume").delete().eq("id", resume_id).execute()

    # Also clear legacy resume_analysis
    try:
        db.table("resume_analysis").delete().eq("user_id", user.id).execute()
    except Exception:
        pass

    return {"deleted": True}


# --- Section CRUD ---

class SectionCreate(BaseModel):
    resume_id: str
    section_type: str
    sort_order: int = 0
    content: dict

class SectionUpdate(BaseModel):
    content: dict

@router.post("/sections")
async def create_section(
    req: SectionCreate,
    user: AuthUser = Depends(get_current_user),
):
    """Add a new section to a resume."""
    db = get_supabase()

    resume = db.table("resume").select("user_id").eq("id", req.resume_id).maybe_single().execute()
    if not resume or not resume.data or resume.data["user_id"] != user.id:
        raise HTTPException(403, "Not authorized")

    # Shift existing sections at or after this sort_order down by 1
    existing = (
        db.table("resume_section")
        .select("id,sort_order")
        .eq("resume_id", req.resume_id)
        .gte("sort_order", req.sort_order)
        .order("sort_order", desc=True)
        .execute()
    )
    for s in (existing.data or []):
        db.table("resume_section").update(
            {"sort_order": s["sort_order"] + 1}
        ).eq("id", s["id"]).execute()

    resp = db.table("resume_section").insert({
        "resume_id": req.resume_id,
        "section_type": req.section_type,
        "sort_order": req.sort_order,
        "content": req.content,
    }).execute()

    return resp.data[0]

@router.put("/sections/{section_id}")
async def update_section(
    section_id: str,
    req: SectionUpdate,
    user: AuthUser = Depends(get_current_user),
):
    """Update a resume section's content (inline editing)."""
    db = get_supabase()

    section = db.table("resume_section").select("resume_id").eq("id", section_id).maybe_single().execute()
    if not section or not section.data:
        raise HTTPException(404, "Section not found")

    resume = db.table("resume").select("user_id").eq("id", section.data["resume_id"]).maybe_single().execute()
    if not resume or not resume.data or resume.data["user_id"] != user.id:
        raise HTTPException(403, "Not authorized")

    resp = db.table("resume_section").update({
        "content": req.content,
        "updated_at": "now()",
    }).eq("id", section_id).execute()

    return resp.data[0]


@router.delete("/sections/{section_id}")
async def delete_section(
    section_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Delete a resume section."""
    db = get_supabase()

    section = db.table("resume_section").select("resume_id").eq("id", section_id).maybe_single().execute()
    if not section or not section.data:
        raise HTTPException(404, "Section not found")

    resume = db.table("resume").select("user_id").eq("id", section.data["resume_id"]).maybe_single().execute()
    if not resume or not resume.data or resume.data["user_id"] != user.id:
        raise HTTPException(403, "Not authorized")

    db.table("resume_section").delete().eq("id", section_id).execute()
    return {"deleted": True}


# --- Coach Chat (SSE Streaming) ---

class ResumeChatRequest(BaseModel):
    resume_id: str
    messages: list[dict]
    session_id: Optional[str] = None

@router.post("/chat")
async def resume_chat(
    req: ResumeChatRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Stream a resume coaching conversation via SSE."""
    db = get_supabase()

    resume = db.table("resume").select("*").eq("id", req.resume_id).maybe_single().execute()
    if not resume or not resume.data or resume.data["user_id"] != user.id:
        raise HTTPException(403, "Not authorized")

    user_context = await coach.build_user_context(user.id)

    resume_sections = (
        db.table("resume_section").select("*")
        .eq("resume_id", req.resume_id)
        .order("sort_order").execute()
    )
    resume_analysis = (
        db.table("resume_analysis_v2").select("*")
        .eq("resume_id", req.resume_id)
        .maybe_single().execute()
    )

    sections_text = ""
    if resume_sections and resume_sections.data:
        for s in resume_sections.data:
            sections_text += f"\n[{s['section_type']}] {json_mod.dumps(s['content'])}"

    analysis_text = ""
    if resume_analysis and resume_analysis.data:
        a = resume_analysis.data
        analysis_text = (
            f"\nGrade: {a.get('overall_grade')}, "
            f"ATS: {a.get('ats_compatibility')}, "
            f"Bullets: {a.get('bullet_quality')}, "
            f"Top fixes: {json_mod.dumps(a.get('top_fixes', []))}"
        )

    context_msg = {
        "role": "user",
        "content": (
            f"[CONTEXT — Resume sections:{sections_text}\n"
            f"Analysis:{analysis_text}]\n\n"
            f"Help me improve my resume based on the analysis above."
        ),
    }

    chat_messages = [context_msg] + [
        {"role": m.get("role", "user"), "content": m.get("content", "")}
        for m in req.messages
    ]

    session_id = req.session_id
    if not session_id:
        resp = db.table("resume_coach_session").insert({
            "resume_id": req.resume_id,
            "status": "active",
        }).execute()
        session_id = resp.data[0]["id"]

    async def event_stream():
        full_response = ""
        EDIT_MARKER = "|||SUGGESTED_EDIT|||"
        emit_buffer = ""
        edit_started = False

        async for token in coach.coach_stream("resume_chat", user_context, chat_messages):
            full_response += token

            if edit_started:
                continue

            emit_buffer += token

            if EDIT_MARKER in emit_buffer:
                before = emit_buffer.split(EDIT_MARKER)[0]
                if before:
                    yield f"event: token\ndata: {json_mod.dumps({'text': before})}\n\n"
                edit_started = True
                continue

            might_be = False
            for i in range(1, min(len(EDIT_MARKER), len(emit_buffer)) + 1):
                if EDIT_MARKER.startswith(emit_buffer[-i:]):
                    might_be = True
                    break

            if not might_be:
                yield f"event: token\ndata: {json_mod.dumps({'text': emit_buffer})}\n\n"
                emit_buffer = ""

        if emit_buffer and not edit_started:
            yield f"event: token\ndata: {json_mod.dumps({'text': emit_buffer})}\n\n"

        if "|||SUGGESTED_EDIT|||" in full_response and "|||END_EDIT|||" in full_response:
            json_str = full_response.split("|||SUGGESTED_EDIT|||")[1].split("|||END_EDIT|||")[0].strip()
            try:
                edits = json_mod.loads(json_str)
                yield f"event: suggested_edit\ndata: {json_mod.dumps(edits)}\n\n"
            except json_mod.JSONDecodeError:
                pass

        visible = full_response
        if "|||SUGGESTED_EDIT" in visible:
            visible = visible.split("|||SUGGESTED_EDIT")[0].strip()

        if visible:
            if req.messages:
                last_user = req.messages[-1]
                db.table("resume_coach_message").insert({
                    "session_id": session_id,
                    "role": "user",
                    "content": last_user.get("content", ""),
                }).execute()

            db.table("resume_coach_message").insert({
                "session_id": session_id,
                "role": "assistant",
                "content": visible,
            }).execute()

        yield f"event: session\ndata: {json_mod.dumps({'session_id': session_id})}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# --- Coach Session ---

@router.get("/chat/session")
async def get_coach_session(
    resume_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Get active coach session and messages for a resume."""
    db = get_supabase()

    session = (
        db.table("resume_coach_session").select("*")
        .eq("resume_id", resume_id)
        .eq("status", "active")
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single().execute()
    )

    if not session or not session.data:
        return {"session": None, "messages": []}

    messages = (
        db.table("resume_coach_message").select("*")
        .eq("session_id", session.data["id"])
        .order("created_at")
        .execute()
    )

    return {"session": session.data, "messages": messages.data or []}
