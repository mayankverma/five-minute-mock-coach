"""Practice session API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.question_service import QuestionService
from backend.api.services.scoring_engine import ScoringEngine
from backend.api.services.ai_coach import AICoachService

router = APIRouter(prefix="/api/practice", tags=["practice"])
question_service = QuestionService()
scoring_engine = ScoringEngine()
coach = AICoachService()


class PracticeStartRequest(BaseModel):
    workspace_id: Optional[str] = None
    drill_type: Optional[str] = "behavioral"
    stage: Optional[int] = 1
    question_count: int = 3
    theme: Optional[str] = None
    difficulty: Optional[str] = None


class SubmitAnswerRequest(BaseModel):
    question_id: str
    answer: str
    self_scores: Optional[dict] = None


@router.post("/start")
async def start_practice(
    req: PracticeStartRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Start a practice session — selects questions and creates a session record."""
    db = get_supabase()

    questions = await question_service.get_questions(
        user_id=user.id,
        workspace_id=req.workspace_id,
        theme=req.theme,
        difficulty=req.difficulty,
        count=req.question_count,
        stage=req.stage,
    )

    if not questions:
        raise HTTPException(404, "No questions available for this configuration")

    session_data = {
        "user_id": user.id,
        "drill_type": req.drill_type,
        "stage": req.stage,
        "question_ids": [q["id"] for q in questions],
    }
    if req.workspace_id:
        session_data["workspace_id"] = req.workspace_id

    session_resp = db.table("practice_session").insert(session_data).execute()
    session = session_resp.data[0]

    return {
        "session_id": session["id"],
        "questions": questions,
        "stage": req.stage,
        "drill_type": req.drill_type,
    }


@router.post("/{session_id}/submit")
async def submit_answer(
    session_id: str,
    req: SubmitAnswerRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Submit an answer for scoring within a practice session."""
    db = get_supabase()

    # Verify session belongs to user
    session_resp = (
        db.table("practice_session")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(404, "Practice session not found")

    # Get the question
    q_resp = db.table("question").select("*").eq("id", req.question_id).maybe_single().execute()
    if not q_resp.data:
        raise HTTPException(404, "Question not found")

    # Build user context and score the answer
    user_context = await coach.build_user_context(
        user.id, session_resp.data.get("workspace_id")
    )
    score_result = await scoring_engine.score_answer(
        question=q_resp.data["question_text"],
        answer=req.answer,
        user_context=user_context,
        self_scores=req.self_scores,
    )

    # Save score entry
    score_avg = round(
        (
            score_result.substance
            + score_result.structure
            + score_result.relevance
            + score_result.credibility
            + score_result.differentiation
        )
        / 5,
        1,
    )

    score_data = {
        "user_id": user.id,
        "entry_type": "practice",
        "context": q_resp.data.get("title", req.question_id),
        "substance": score_result.substance,
        "structure": score_result.structure,
        "relevance": score_result.relevance,
        "credibility": score_result.credibility,
        "differentiation": score_result.differentiation,
        "hire_signal": score_result.hire_signal,
        "raw_feedback": {
            "feedback": score_result.feedback,
            "strongest": score_result.strongest_dimension,
            "weakest": score_result.weakest_dimension,
            "suggestion": score_result.improvement_suggestion,
        },
    }
    if session_resp.data.get("workspace_id"):
        score_data["workspace_id"] = session_resp.data["workspace_id"]

    db.table("score_entry").insert(score_data).execute()

    # Record question history
    await question_service.record_history(
        user_id=user.id,
        question_id=req.question_id,
        workspace_id=session_resp.data.get("workspace_id"),
        score_avg=score_avg,
        source="practice",
    )

    # Update session transcript
    current_transcript = session_resp.data.get("transcript") or ""
    updated_transcript = (
        current_transcript
        + f"\n\n---\nQ: {q_resp.data['question_text']}\nA: {req.answer}\nScore: {score_avg}"
    )
    db.table("practice_session").update({"transcript": updated_transcript}).eq(
        "id", session_id
    ).execute()

    return {
        "scores": score_result.model_dump(),
        "average": score_avg,
    }


@router.get("/history")
async def get_practice_history(
    user: AuthUser = Depends(get_current_user),
    workspace_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """Get past practice sessions."""
    db = get_supabase()
    query = (
        db.table("practice_session")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if workspace_id:
        query = query.eq("workspace_id", workspace_id)

    resp = query.execute()
    return {"sessions": resp.data or [], "count": len(resp.data or [])}
