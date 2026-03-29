"""Question bank API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.question_service import QuestionService

router = APIRouter(prefix="/api/questions", tags=["questions"])
question_service = QuestionService()


@router.get("")
async def get_questions(
    user: AuthUser = Depends(get_current_user),
    theme: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    count: int = Query(3, ge=1, le=20),
    workspace_id: Optional[str] = Query(None),
    stage: Optional[int] = Query(None, ge=1, le=8),
):
    """Fetch questions filtered by theme, difficulty, and context."""
    questions = await question_service.get_questions(
        user_id=user.id,
        workspace_id=workspace_id,
        theme=theme,
        difficulty=difficulty,
        count=count,
        stage=stage,
    )
    return {"questions": questions, "count": len(questions)}


@router.get("/random")
async def get_random_question(
    user: AuthUser = Depends(get_current_user),
    workspace_id: Optional[str] = Query(None),
):
    """Get a single context-aware random question."""
    question = await question_service.get_random_question(user.id, workspace_id)
    if not question:
        return {"question": None, "message": "No questions available"}
    return {"question": question}


@router.get("/themes")
async def get_themes(user: AuthUser = Depends(get_current_user)):
    """Get all unique question themes."""
    db = get_supabase()
    resp = db.table("question").select("theme").execute()
    themes = sorted(set(r["theme"] for r in (resp.data or []) if r.get("theme")))
    return {"themes": themes}


# ─── Starred Questions (MUST be before /{question_id} catch-all) ───

class StarRequest(BaseModel):
    question_id: str
    source: str = "bank"


@router.get("/starred")
async def get_starred_questions(
    user: AuthUser = Depends(get_current_user),
):
    """Get all starred question IDs for the current user."""
    db = get_supabase()
    resp = (
        db.table("user_starred_question")
        .select("question_id, source")
        .eq("user_id", user.id)
        .execute()
    )
    return {"starred": resp.data or []}


@router.post("/star")
async def star_question(
    req: StarRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Star a question for quick access."""
    db = get_supabase()
    db.table("user_starred_question").upsert({
        "user_id": user.id,
        "question_id": req.question_id,
        "source": req.source,
    }).execute()
    return {"starred": True, "question_id": req.question_id}


@router.delete("/star")
async def unstar_question(
    req: StarRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Unstar a question."""
    db = get_supabase()
    db.table("user_starred_question").delete().eq(
        "user_id", user.id
    ).eq("question_id", req.question_id).execute()
    return {"starred": False, "question_id": req.question_id}


# ─── Single question by ID (catch-all, must be last) ───

@router.get("/{question_id}")
async def get_question(
    question_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Get a single question by ID."""
    db = get_supabase()
    resp = db.table("question").select("*").eq("id", question_id).maybe_single().execute()
    if not resp or not resp.data:
        return {"error": "Question not found"}, 404
    return resp.data
