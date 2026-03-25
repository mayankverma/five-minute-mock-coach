"""Resume API — upload, parse, analyze, section CRUD, coach chat."""

import json as json_mod
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.ai_coach import AICoachService
from backend.api.services.resume_service import ResumeService
from backend.api.services.resume_parser import ResumeParser

router = APIRouter(prefix="/api/resume", tags=["resume"])
coach = AICoachService()
resume_service = ResumeService()
resume_parser = ResumeParser()


# --- Upload + Analyze ---

@router.post("/upload")
async def upload_resume(
    user: AuthUser = Depends(get_current_user),
    file: UploadFile = File(...),
    resume_text: Optional[str] = Form(None),
    job_id: Optional[str] = Form(None),
):
    """Upload resume file, parse into sections, and run AI analysis."""
    db = get_supabase()

    content = await file.read()
    text = resume_text or content.decode("utf-8", errors="ignore")

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

    # Run analysis
    analysis = await resume_service.analyze_resume(text, user_context)

    # Save to resume_analysis_v2
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
    db.table("resume_analysis_v2").insert(analysis_data).execute()

    # Also save to legacy resume_analysis for backward compat
    await resume_service.save_analysis(user.id, analysis)

    return {"resume_id": resume_id, "analysis": analysis_data, "sections_count": len(sections)}


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


# --- Section CRUD ---

class SectionUpdate(BaseModel):
    content: dict

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
