"""Mock interview API endpoints — start, submit (silent scoring), debrief, history."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.question_service import QuestionService
from backend.api.services.scoring_engine import ScoringEngine
from backend.api.services.ai_coach import AICoachService

router = APIRouter(prefix="/api/mock", tags=["mock"])
question_service = QuestionService()
scoring_engine = ScoringEngine()
coach = AICoachService()

MOCK_FORMATS: dict[str, dict] = {
    "behavioral_screen": {"name": "Behavioral Screen", "questions": 4, "duration": 30},
    "deep_behavioral": {"name": "Deep Behavioral", "questions": 6, "duration": 45},
    "system_design": {"name": "System Design", "questions": 4, "duration": 60},
    "panel": {"name": "Panel", "questions": 5, "duration": 45},
    "bar_raiser": {"name": "Bar Raiser", "questions": 6, "duration": 50},
    "tech_behavioral": {"name": "Technical + Behavioral", "questions": 5, "duration": 45},
}


# ─── Request bodies ───────────────────────────────────────────────────────────


class MockStartRequest(BaseModel):
    format_id: str
    workspace_id: Optional[str] = None


class MockSubmitRequest(BaseModel):
    question_id: str
    question_text: str
    answer: str
    input_mode: str = "text"
    question_number: int = 1


# ─── Start Mock ───────────────────────────────────────────────────────────────


@router.post("/start")
async def start_mock(
    req: MockStartRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Start a mock interview session in the selected format."""
    if req.format_id not in MOCK_FORMATS:
        raise HTTPException(
            400,
            f"Invalid format_id: {req.format_id}. Must be one of: {list(MOCK_FORMATS.keys())}",
        )

    fmt = MOCK_FORMATS[req.format_id]
    db = get_supabase()

    questions = await question_service.get_questions(
        user_id=user.id,
        workspace_id=req.workspace_id,
        count=fmt["questions"],
    )

    if not questions:
        raise HTTPException(404, "No questions available for this format")

    session_data = {
        "user_id": user.id,
        "tier": "session",
        "drill_type": "mock",
        "question_ids": [q.get("id", "") for q in questions],
    }
    if req.workspace_id:
        session_data["workspace_id"] = req.workspace_id

    session_resp = db.table("practice_session").insert(session_data).execute()
    session = session_resp.data[0]

    return {
        "session_id": session["id"],
        "questions": questions,
        "format": {
            "id": req.format_id,
            "name": fmt["name"],
            "questions": fmt["questions"],
            "duration": fmt["duration"],
        },
    }


# ─── Submit Answer (silent) ───────────────────────────────────────────────────


@router.post("/{session_id}/submit")
async def submit_mock_answer(
    session_id: str,
    req: MockSubmitRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Record and score a mock answer silently — scores are NOT returned."""
    db = get_supabase()

    session_resp = (
        db.table("practice_session")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(404, "Mock session not found")

    session = session_resp.data
    workspace_id = session.get("workspace_id")

    user_context = await coach.build_user_context(user.id, workspace_id)
    score_result = await scoring_engine.score_answer(
        question=req.question_text,
        answer=req.answer,
        user_context=user_context,
        input_mode=req.input_mode,
    )

    score_data = {
        "user_id": user.id,
        "entry_type": "mock",
        "context": req.question_text[:200],
        "answer_text": req.answer,
        "substance": score_result.substance,
        "structure": score_result.structure,
        "relevance": score_result.relevance,
        "credibility": score_result.credibility,
        "differentiation": score_result.differentiation,
        "hire_signal": score_result.hire_signal,
        "input_mode": req.input_mode,
        "question_id": req.question_id,
        "raw_feedback": {
            "feedback": score_result.feedback,
            "strongest": score_result.strongest_dimension,
            "weakest": score_result.weakest_dimension,
            "suggestion": score_result.improvement_suggestion,
            "coaching_bullets": score_result.coaching_bullets,
            "exemplar_answer": score_result.exemplar_answer,
            "micro_drill": score_result.micro_drill,
            "question_number": req.question_number,
        },
    }
    if score_result.presence is not None:
        score_data["presence"] = score_result.presence
    if workspace_id:
        score_data["workspace_id"] = workspace_id

    db.table("score_entry").insert(score_data).execute()

    return {"status": "recorded", "question_number": req.question_number}


# ─── Debrief ──────────────────────────────────────────────────────────────────


@router.post("/{session_id}/debrief")
async def mock_debrief(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Generate a full holistic debrief for a completed mock interview."""
    db = get_supabase()

    session_resp = (
        db.table("practice_session")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(404, "Mock session not found")

    session = session_resp.data
    workspace_id = session.get("workspace_id")

    scores_resp = (
        db.table("score_entry")
        .select("*")
        .eq("user_id", user.id)
        .eq("entry_type", "mock")
        .order("created_at", desc=False)
        .execute()
    )

    # Filter to scores that reference questions in this session
    all_scores = scores_resp.data or []
    question_ids = set(session.get("question_ids") or [])
    scores = [s for s in all_scores if s.get("question_id") in question_ids] if question_ids else all_scores

    if not scores:
        raise HTTPException(404, "No scores found for this session")

    per_question = []
    for s in scores:
        raw = s.get("raw_feedback") or {}
        per_question.append({
            "question_number": raw.get("question_number", "?"),
            "question_text": s.get("context", ""),
            "substance": s.get("substance"),
            "structure": s.get("structure"),
            "relevance": s.get("relevance"),
            "credibility": s.get("credibility"),
            "differentiation": s.get("differentiation"),
            "hire_signal": s.get("hire_signal"),
            "feedback": raw.get("feedback"),
            "strongest": raw.get("strongest"),
            "weakest": raw.get("weakest"),
        })

    message = (
        f"## Mock Interview Scores\n\n"
        f"{json.dumps(per_question, indent=2)}\n\n"
        f"## Instructions\n"
        f"Provide a complete mock interview debrief as JSON with keys: "
        f"per_question_scores, arc_analysis, story_diversity, holistic_patterns, "
        f"interviewer_monologue, hire_signal, top_3_changes."
    )

    user_context = await coach.build_user_context(user.id, workspace_id)
    raw_json = await coach.coach_json(
        command="mock_debrief",
        user_context=user_context,
        message=message,
        max_tokens=16000,
    )

    try:
        debrief = json.loads(raw_json)
    except json.JSONDecodeError:
        debrief = {"raw": raw_json}

    return {"debrief": debrief, "session_id": session_id}


# ─── History ──────────────────────────────────────────────────────────────────


@router.get("/history")
async def mock_history(
    user: AuthUser = Depends(get_current_user),
):
    """Return past mock interview sessions."""
    db = get_supabase()

    resp = (
        db.table("practice_session")
        .select("*")
        .eq("user_id", user.id)
        .eq("drill_type", "mock")
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    return {"sessions": resp.data or [], "count": len(resp.data or [])}
