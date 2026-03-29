"""Practice session API endpoints — quick, guided, shuffle, debrief, daily tracking."""

import random
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.question_service import QuestionService, STAGE_CONFIG
from backend.api.services.scoring_engine import ScoringEngine
from backend.api.services.question_generator import QuestionGenerator
from backend.api.services.ai_coach import AICoachService

router = APIRouter(prefix="/api/practice", tags=["practice"])
question_service = QuestionService()
scoring_engine = ScoringEngine()
question_generator = QuestionGenerator()
coach = AICoachService()

# Tier → default question count
TIER_DEFAULTS = {
    "atomic": 1,
    "session": 5,
}

ALL_DIMENSIONS = ["substance", "structure", "relevance", "credibility", "differentiation"]


# ─── Request bodies ──────────────────────────────────────────────────────────


class QuickStartRequest(BaseModel):
    workspace_id: Optional[str] = None
    tier: str = "atomic"
    round_id: Optional[str] = None
    theme: Optional[str] = None
    source_filter: Optional[str] = None
    question_count: Optional[int] = None
    question_ids: Optional[list[str]] = None


class GuidedStartRequest(BaseModel):
    workspace_id: Optional[str] = None
    stage: int = 1
    question_count: int = 3


class SubmitAnswerRequest(BaseModel):
    question_id: str
    question_text: str
    answer: str
    input_mode: str = "text"
    attempt_number: int = 1
    self_scores: Optional[dict] = None


class ShuffleRequest(BaseModel):
    question_id: str
    question_text: str
    used_variations: list[str] = []


# ─── Quick Practice ──────────────────────────────────────────────────────────


@router.get("/quick/preview")
async def quick_preview(
    user: AuthUser = Depends(get_current_user),
    theme: Optional[str] = Query(None),
    source_filter: Optional[str] = Query(None),
    count: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
    shuffle: bool = Query(False),
    exclude_ids: Optional[str] = Query(None),
):
    """Browse questions with pagination, sorted by starred-first then frequency.

    When shuffle=True, returns a random selection excluding exclude_ids (comma-separated).
    """
    db = get_supabase()

    # Get user's starred question IDs
    try:
        starred_resp = (
            db.table("user_starred_question")
            .select("question_id")
            .eq("user_id", user.id)
            .execute()
        )
        starred_ids = {r["question_id"] for r in (starred_resp.data or [])}
    except Exception:
        starred_ids = set()

    freq_order = {"very_high": 0, "high": 1, "medium": 2}

    # Parse exclude_ids if provided (for shuffle)
    excluded = set()
    if exclude_ids:
        excluded = {eid.strip() for eid in exclude_ids.split(",") if eid.strip()}

    if not source_filter or source_filter == "bank":
        # Query bank questions
        query = db.table("question").select("*")
        if theme:
            query = query.eq("theme", theme)

        # Get total count
        count_query = db.table("question").select("id", count="exact")
        if theme:
            count_query = count_query.eq("theme", theme)
        count_resp = count_query.execute()
        total = count_resp.count or 0

        # Fetch all for sorting (up to 253 questions, small enough)
        resp = query.execute()
        pool = resp.data or []

        if shuffle:
            # Shuffle mode: exclude specified IDs, return random selection
            available = [q for q in pool if q.get("id") not in excluded]
            import random as _random
            _random.shuffle(available)
            page = available[:count]
        else:
            # Normal mode: starred first, frequency sorted, theme diverse
            def sort_key(q):
                is_starred = 1 if q.get("id") in starred_ids else 0
                freq = freq_order.get(q.get("frequency", "medium"), 2)
                return (-is_starred, freq, q.get("theme", ""), q.get("title", ""))

            pool.sort(key=sort_key)

            # If no theme filter, enforce theme diversity (max 2 consecutive same theme)
            if not theme:
                diverse = []
                theme_streak = {}
                for q in pool:
                    t = q.get("theme", "")
                    theme_streak[t] = theme_streak.get(t, 0) + 1
                    if theme_streak[t] <= 2:
                        diverse.append(q)
                pool = diverse if diverse else pool

            # Apply pagination
            page = pool[offset:offset + count]

        # Annotate with source and starred
        for q in page:
            q["_source"] = "bank"
            q["_source_detail"] = f"From question bank — {q.get('frequency', 'medium')} frequency"
            q["starred"] = q.get("id") in starred_ids

        return {"questions": page, "total_count": total}

    else:
        # For other sources, use question service
        questions = await question_service.get_questions(
            user_id=user.id,
            theme=theme,
            source_filter=source_filter,
            count=count,
        )
        for q in questions:
            q["starred"] = q.get("id") in starred_ids
        return {"questions": questions, "total_count": len(questions)}


@router.post("/quick/start")
async def quick_start(
    req: QuickStartRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Start a quick practice session (atomic / session / round_prep)."""
    db = get_supabase()

    if req.tier not in TIER_DEFAULTS:
        raise HTTPException(400, f"Invalid tier: {req.tier}. Must be one of: {list(TIER_DEFAULTS.keys())}")

    count = req.question_count or TIER_DEFAULTS[req.tier]

    # If specific question IDs provided, use them directly
    if req.question_ids and len(req.question_ids) > 0:
        # Fetch the specified questions from the bank
        q_resp = (
            db.table("question")
            .select("*")
            .in_("id", req.question_ids)
            .execute()
        )
        questions = q_resp.data or []

        # Also check story_question and gap_question for non-bank IDs
        found_ids = {q["id"] for q in questions}
        missing_ids = [qid for qid in req.question_ids if qid not in found_ids]
        if missing_ids:
            sq_resp = db.table("story_question").select("*").in_("id", missing_ids).execute()
            for sq in (sq_resp.data or []):
                sq["question_text"] = sq.get("question_text", "")
                sq["_source"] = "story_specific"
                questions.append(sq)

            found_ids = {q["id"] for q in questions}
            still_missing = [qid for qid in req.question_ids if qid not in found_ids]
            if still_missing:
                gq_resp = db.table("gap_question").select("*").in_("id", still_missing).execute()
                for gq in (gq_resp.data or []):
                    gq["question_text"] = gq.get("question_text", "")
                    gq["_source"] = "resume_gap"
                    questions.append(gq)

        if not questions:
            raise HTTPException(404, "No questions found for the provided IDs")

        # Determine tier based on count
        tier = "atomic" if len(questions) == 1 else "session"

        session_data = {
            "user_id": user.id,
            "tier": tier,
            "question_ids": [q.get("id", "") for q in questions],
        }
        if req.workspace_id:
            session_data["workspace_id"] = req.workspace_id

        session_resp = db.table("practice_session").insert(session_data).execute()
        session = session_resp.data[0]

        return {
            "session_id": session["id"],
            "questions": questions,
            "tier": tier,
        }

    # For round_prep with round_id, fetch round context
    round_context = None
    workspace_id = req.workspace_id
    if req.tier == "round_prep" and req.round_id:
        round_resp = (
            db.table("interview_round")
            .select("*, job_workspace(company_name, role_title, competency_ranking)")
            .eq("id", req.round_id)
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        if not round_resp.data:
            raise HTTPException(404, "Interview round not found")

        ws_data = round_resp.data.get("job_workspace") or {}
        workspace_id = workspace_id or round_resp.data.get("workspace_id")
        competencies = ws_data.get("competency_ranking") or []
        round_context = {
            "company": ws_data.get("company_name", ""),
            "role": ws_data.get("role_title", ""),
            "round_type": round_resp.data.get("round_type", ""),
            "round_number": round_resp.data.get("round_number"),
            "format": round_resp.data.get("format", ""),
            "competencies": (
                [c.get("name", c) if isinstance(c, dict) else c for c in competencies]
                if isinstance(competencies, list) else []
            ),
        }

    questions = await question_service.get_questions(
        user_id=user.id,
        workspace_id=workspace_id,
        theme=req.theme,
        source_filter=req.source_filter,
        count=count,
    )

    if not questions:
        raise HTTPException(404, "No questions available for this configuration")

    session_data = {
        "user_id": user.id,
        "tier": req.tier,
        "question_ids": [q.get("id", "") for q in questions],
    }
    if workspace_id:
        session_data["workspace_id"] = workspace_id
    if req.round_id:
        session_data["round_id"] = req.round_id

    session_resp = db.table("practice_session").insert(session_data).execute()
    session = session_resp.data[0]

    return {
        "session_id": session["id"],
        "questions": questions,
        "tier": req.tier,
        "round_context": round_context,
    }


# ─── Guided Practice ─────────────────────────────────────────────────────────


@router.post("/guided/start")
async def guided_start(
    req: GuidedStartRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Start a guided practice session (8-stage drill program)."""
    db = get_supabase()

    if req.stage < 1 or req.stage > 8:
        raise HTTPException(400, "Stage must be between 1 and 8")

    stage_cfg = STAGE_CONFIG.get(req.stage)
    if not stage_cfg:
        raise HTTPException(400, f"Invalid stage: {req.stage}")

    # Check drill progression
    try:
        prog_resp = (
            db.table("drill_progression")
            .select("*")
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        progression = prog_resp.data if prog_resp else None
    except Exception:
        progression = None
    current_unlocked = progression["current_stage"] if progression else 1
    skipped = req.stage > current_unlocked

    # If no progression record exists, create one
    if not progression:
        db.table("drill_progression").insert({
            "user_id": user.id,
            "current_stage": 1,
            "gates_passed": [],
        }).execute()
        current_unlocked = 1

    # If user jumps ahead, record skipped=True but allow it
    questions = await question_service.get_questions(
        user_id=user.id,
        workspace_id=req.workspace_id,
        count=req.question_count,
        stage=req.stage,
        difficulty=stage_cfg.get("difficulty"),
    )

    if not questions:
        raise HTTPException(404, "No questions available for this stage")

    session_data = {
        "user_id": user.id,
        "tier": "session",
        "drill_type": "guided",
        "stage": req.stage,
        "question_ids": [q.get("id", "") for q in questions],
    }
    if req.workspace_id:
        session_data["workspace_id"] = req.workspace_id

    session_resp = db.table("practice_session").insert(session_data).execute()
    session = session_resp.data[0]

    return {
        "session_id": session["id"],
        "questions": questions,
        "stage": req.stage,
        "stage_info": {
            "name": stage_cfg["name"],
            "difficulty": stage_cfg.get("difficulty"),
            "gate_dim": stage_cfg.get("gate_dim"),
            "gate_score": stage_cfg.get("gate_score"),
            "time_limit": stage_cfg.get("time_limit"),
        },
        "skipped": skipped,
        "current_unlocked_stage": current_unlocked,
    }


@router.get("/guided/progression")
async def get_guided_progression(
    user: AuthUser = Depends(get_current_user),
):
    """Get user's guided drill progression and stage config."""
    db = get_supabase()

    try:
        prog_resp = (
            db.table("drill_progression")
            .select("*")
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        progression = (prog_resp.data if prog_resp else None) or {
            "current_stage": 1,
            "gates_passed": [],
        }
    except Exception:
        progression = {"current_stage": 1, "gates_passed": []}

    return {
        "progression": progression,
        "stages": {str(k): v for k, v in STAGE_CONFIG.items()},
    }


@router.get("/guided/preview")
async def guided_preview(
    user: AuthUser = Depends(get_current_user),
    stage: int = Query(1, ge=1, le=8),
    count: int = Query(3, ge=1, le=10),
):
    """Preview questions for a guided stage without creating a session."""
    stage_cfg = STAGE_CONFIG.get(stage)
    if not stage_cfg:
        raise HTTPException(400, f"Invalid stage: {stage}")

    questions = await question_service.get_questions(
        user_id=user.id,
        count=count,
        stage=stage,
        difficulty=stage_cfg.get("difficulty"),
    )

    return {
        "questions": questions,
        "stage": stage,
        "stage_info": {
            "name": stage_cfg["name"],
            "difficulty": stage_cfg.get("difficulty"),
            "gate_dim": stage_cfg.get("gate_dim"),
            "gate_score": stage_cfg.get("gate_score"),
        },
    }


# ─── Submit Answer ────────────────────────────────────────────────────────────


@router.post("/{session_id}/submit")
async def submit_answer(
    session_id: str,
    req: SubmitAnswerRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Submit an answer for scoring within a practice session."""
    db = get_supabase()

    # Verify session belongs to user
    try:
        session_resp = (
            db.table("practice_session")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        session = session_resp.data if session_resp else None
    except Exception:
        session = None
    if not session:
        raise HTTPException(404, "Practice session not found")

    workspace_id = session.get("workspace_id")

    # Build user context and score the answer
    user_context = await coach.build_user_context(user.id, workspace_id)
    score_result = await scoring_engine.score_answer(
        question=req.question_text,
        answer=req.answer,
        user_context=user_context,
        self_scores=req.self_scores,
        input_mode=req.input_mode,
    )

    # Calculate average across 5 core dimensions
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

    # Save score entry with new fields (including user's answer for review)
    score_data = {
        "user_id": user.id,
        "entry_type": "practice",
        "context": req.question_text[:200],
        "answer_text": req.answer,
        "substance": score_result.substance,
        "structure": score_result.structure,
        "relevance": score_result.relevance,
        "credibility": score_result.credibility,
        "differentiation": score_result.differentiation,
        "hire_signal": score_result.hire_signal,
        "attempt_number": req.attempt_number,
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
        },
    }
    if score_result.presence is not None:
        score_data["presence"] = score_result.presence
    if workspace_id:
        score_data["workspace_id"] = workspace_id

    db.table("score_entry").insert(score_data).execute()

    # Record question history
    await question_service.record_history(
        user_id=user.id,
        question_id=req.question_id,
        workspace_id=workspace_id,
        score_avg=score_avg,
        source="practice",
    )

    # Update daily practice (increment count, update streak)
    _update_daily_practice(db, user.id)

    # For guided sessions, check stage gate advancement
    gate_result = None
    if session.get("drill_type") == "guided" and session.get("stage"):
        gate_result = _check_stage_gate(db, user.id, session["stage"])

    return {
        "scores": score_result.model_dump(),
        "average": score_avg,
        "gate_result": gate_result,
    }


# ─── Shuffle ──────────────────────────────────────────────────────────────────


@router.post("/{session_id}/shuffle")
async def shuffle_question(
    session_id: str,
    req: ShuffleRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Get a variation of a question (stored or AI-generated)."""
    db = get_supabase()

    # Verify session ownership
    session_resp = (
        db.table("practice_session")
        .select("id, user_id, workspace_id")
        .eq("id", session_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not session_resp.data:
        raise HTTPException(404, "Practice session not found")

    workspace_id = session_resp.data.get("workspace_id")

    # Try 1: Check question table for stored variations
    q_resp = (
        db.table("question")
        .select("variations")
        .eq("id", req.question_id)
        .maybe_single()
        .execute()
    )
    if q_resp.data and q_resp.data.get("variations"):
        stored = q_resp.data["variations"]
        unused = [v for v in stored if v not in req.used_variations]
        if unused:
            variation = random.choice(unused)
            return {"variation": variation, "source": "question_bank"}

    # Try 2: Check story_question table
    sq_resp = (
        db.table("story_question")
        .select("variations")
        .eq("id", req.question_id)
        .maybe_single()
        .execute()
    )
    if sq_resp.data and sq_resp.data.get("variations"):
        stored = sq_resp.data["variations"]
        unused = [v for v in stored if v not in req.used_variations]
        if unused:
            variation = random.choice(unused)
            return {"variation": variation, "source": "story_question"}

    # Try 3: Check gap_question table
    gq_resp = (
        db.table("gap_question")
        .select("variations")
        .eq("id", req.question_id)
        .maybe_single()
        .execute()
    )
    if gq_resp.data and gq_resp.data.get("variations"):
        stored = gq_resp.data["variations"]
        unused = [v for v in stored if v not in req.used_variations]
        if unused:
            variation = random.choice(unused)
            return {"variation": variation, "source": "gap_question"}

    # Fallback: AI-generated variations
    user_context = await coach.build_user_context(user.id, workspace_id)
    variations = await question_generator.generate_variations(
        question_text=req.question_text,
        user_context=user_context,
        count=3,
    )

    if variations:
        # Filter out already-used variations
        unused = [v for v in variations if v not in req.used_variations]
        variation = random.choice(unused) if unused else random.choice(variations)
        return {"variation": variation, "source": "ai_generated"}

    raise HTTPException(404, "Could not generate a variation for this question")


# ─── Debrief ──────────────────────────────────────────────────────────────────


@router.post("/{session_id}/debrief")
async def session_debrief(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Generate a session debrief across all scored answers."""
    db = get_supabase()

    # Get session
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

    session = session_resp.data
    workspace_id = session.get("workspace_id")
    tier = session.get("tier", "session")

    # Get scores for this session (matched by user and time proximity)
    question_ids = session.get("question_ids") or []
    scores_resp = (
        db.table("score_entry")
        .select("*")
        .eq("user_id", user.id)
        .eq("entry_type", "practice")
        .order("created_at", desc=True)
        .limit(len(question_ids) if question_ids else 10)
        .execute()
    )
    scores = scores_resp.data or []

    if not scores:
        raise HTTPException(404, "No scores found for this session")

    # Build question list for debrief (from score contexts)
    questions = [
        {"question_text": s.get("context", "")}
        for s in scores
    ]

    # For round_prep, fetch round context
    round_context = None
    if tier == "round_prep" and session.get("round_id"):
        round_resp = (
            db.table("interview_round")
            .select("*, job_workspace(company_name, role_title, competency_ranking)")
            .eq("id", session["round_id"])
            .maybe_single()
            .execute()
        )
        if round_resp.data:
            ws_data = round_resp.data.get("job_workspace") or {}
            competencies = ws_data.get("competency_ranking") or []
            round_context = {
                "company": ws_data.get("company_name", ""),
                "role": ws_data.get("role_title", ""),
                "round_type": round_resp.data.get("round_type", ""),
                "competencies": (
                    [c.get("name", c) if isinstance(c, dict) else c for c in competencies]
                    if isinstance(competencies, list) else []
                ),
            }

    user_context = await coach.build_user_context(user.id, workspace_id)
    debrief = await scoring_engine.generate_session_debrief(
        scores=scores,
        questions=questions,
        user_context=user_context,
        tier=tier,
        round_context=round_context,
    )

    return {"debrief": debrief, "tier": tier}


# ─── Daily Stats ──────────────────────────────────────────────────────────────


@router.get("/daily")
async def get_daily_stats(
    user: AuthUser = Depends(get_current_user),
):
    """Get today's practice stats and current streak."""
    db = get_supabase()
    today = date.today().isoformat()

    try:
        daily_resp = (
            db.table("daily_practice")
            .select("*")
            .eq("user_id", user.id)
            .eq("practice_date", today)
            .maybe_single()
            .execute()
        )
        daily_data = daily_resp.data if daily_resp else None
    except Exception:
        daily_data = None

    if daily_data:
        return {
            "today": {"questions_answered": daily_data.get("questions_answered", 0)},
            "streak": daily_data.get("streak_count", 0),
            "practiced_today": True,
        }

    # No record for today — check yesterday for streak context
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    try:
        yesterday_resp = (
            db.table("daily_practice")
            .select("streak_count")
            .eq("user_id", user.id)
            .eq("practice_date", yesterday)
            .maybe_single()
            .execute()
        )
        last_streak = (yesterday_resp.data.get("streak_count", 0) if yesterday_resp and yesterday_resp.data else 0)
    except Exception:
        last_streak = 0

    return {
        "today": {"questions_answered": 0},
        "streak": 0,
        "practiced_today": False,
    }


# ─── History ──────────────────────────────────────────────────────────────────


@router.get("/history")
async def get_practice_history(
    user: AuthUser = Depends(get_current_user),
    workspace_id: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
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
    if tier:
        query = query.eq("tier", tier)

    resp = query.execute()
    return {"sessions": resp.data or [], "count": len(resp.data or [])}


# ─── Activity ─────────────────────────────────────────────────────────────────


@router.get("/activity")
async def get_practice_activity(
    user: AuthUser = Depends(get_current_user),
    limit: int = Query(30, ge=1, le=100),
):
    """Get detailed practice activity — individual scored answers with feedback."""
    db = get_supabase()

    resp = (
        db.table("score_entry")
        .select("*")
        .eq("user_id", user.id)
        .eq("entry_type", "practice")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    entries = resp.data or []

    # Format for frontend
    activity = []
    for entry in entries:
        feedback = entry.get("raw_feedback") or {}
        activity.append({
            "id": entry.get("id"),
            "question_text": entry.get("context", ""),
            "question_id": entry.get("question_id"),
            "scores": {
                "substance": entry.get("substance"),
                "structure": entry.get("structure"),
                "relevance": entry.get("relevance"),
                "credibility": entry.get("credibility"),
                "differentiation": entry.get("differentiation"),
                "presence": entry.get("presence"),
            },
            "average": round(
                sum(
                    entry.get(d, 0) or 0
                    for d in ["substance", "structure", "relevance", "credibility", "differentiation"]
                ) / 5,
                1,
            ),
            "hire_signal": entry.get("hire_signal"),
            "feedback": feedback.get("feedback", ""),
            "coaching_bullets": feedback.get("coaching_bullets", []),
            "exemplar_answer": feedback.get("exemplar_answer"),
            "micro_drill": feedback.get("micro_drill"),
            "strongest": feedback.get("strongest", ""),
            "weakest": feedback.get("weakest", ""),
            "suggestion": feedback.get("suggestion", ""),
            "attempt_number": entry.get("attempt_number", 1),
            "input_mode": entry.get("input_mode", "text"),
            "answer_text": entry.get("answer_text"),
            "created_at": entry.get("created_at"),
        })

    return {"activity": activity, "count": len(activity)}


# ─── Private helpers ──────────────────────────────────────────────────────────


def _update_daily_practice(db, user_id: str) -> None:
    """Upsert today's daily_practice row, calculating streak from yesterday."""
    try:
        today = date.today().isoformat()
        yesterday = (date.today() - timedelta(days=1)).isoformat()

        # Check if today's record already exists
        try:
            today_resp = (
                db.table("daily_practice")
                .select("*")
                .eq("user_id", user_id)
                .eq("practice_date", today)
                .maybe_single()
                .execute()
            )
            today_data = today_resp.data if today_resp else None
        except Exception:
            today_data = None

        if today_data:
            db.table("daily_practice").update({
                "questions_answered": today_data["questions_answered"] + 1,
                "updated_at": "now()",
            }).eq("user_id", user_id).eq("practice_date", today).execute()
        else:
            # New day — calculate streak from yesterday
            try:
                yesterday_resp = (
                    db.table("daily_practice")
                    .select("streak_count")
                    .eq("user_id", user_id)
                    .eq("practice_date", yesterday)
                    .maybe_single()
                    .execute()
                )
                prev_streak = (yesterday_resp.data["streak_count"] if yesterday_resp and yesterday_resp.data else 0)
            except Exception:
                prev_streak = 0

            db.table("daily_practice").insert({
                "user_id": user_id,
                "practice_date": today,
                "questions_answered": 1,
                "streak_count": prev_streak + 1,
            }).execute()
    except Exception:
        pass  # Don't fail the submit if daily tracking fails


def _check_stage_gate(db, user_id: str, stage: int) -> dict:
    """Check if user has passed the gate for a guided stage.

    Gate criteria: last 3 scores must meet the gate_score threshold
    on the required dimension(s). If passed, advance drill_progression.
    """
    stage_cfg = STAGE_CONFIG.get(stage)
    if not stage_cfg:
        return {"passed": False, "reason": "Invalid stage"}

    gate_dim = stage_cfg.get("gate_dim", "structure")
    gate_score = stage_cfg.get("gate_score", 3.5)

    # Get last 3 score entries for this user (practice type)
    scores_resp = (
        db.table("score_entry")
        .select("substance, structure, relevance, credibility, differentiation")
        .eq("user_id", user_id)
        .eq("entry_type", "practice")
        .order("created_at", desc=True)
        .limit(3)
        .execute()
    )
    scores = scores_resp.data or []

    if len(scores) < 3:
        return {
            "passed": False,
            "reason": f"Need 3 consecutive scores, have {len(scores)}",
            "scores_needed": 3 - len(scores),
        }

    # Determine which dimensions to check
    if gate_dim == "all":
        dims_to_check = ALL_DIMENSIONS
    else:
        dims_to_check = [d.strip() for d in gate_dim.split(",")]

    # Check all 3 scores against the gate
    passed = True
    for score_entry in scores:
        for dim in dims_to_check:
            val = float(score_entry.get(dim, 0))
            if val < gate_score:
                passed = False
                break
        if not passed:
            break

    result = {
        "passed": passed,
        "gate_dim": gate_dim,
        "gate_score": gate_score,
        "stage": stage,
    }

    if passed and stage < 8:
        # Advance drill_progression
        prog_resp = (
            db.table("drill_progression")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if prog_resp.data:
            current = prog_resp.data["current_stage"]
            gates_passed = prog_resp.data.get("gates_passed") or []
            stage_key = str(stage)

            if stage_key not in gates_passed:
                gates_passed.append(stage_key)

            new_stage = max(current, stage + 1)
            db.table("drill_progression").update({
                "current_stage": new_stage,
                "gates_passed": gates_passed,
                "updated_at": "now()",
            }).eq("user_id", user_id).execute()

            result["new_unlocked_stage"] = new_stage
        else:
            # Create progression record
            db.table("drill_progression").insert({
                "user_id": user_id,
                "current_stage": stage + 1,
                "gates_passed": [str(stage)],
            }).execute()
            result["new_unlocked_stage"] = stage + 1

    return result
