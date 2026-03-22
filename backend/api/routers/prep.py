"""Interview prep endpoints — research, decode, prep brief, concerns, hype, debrief."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.api.auth import get_current_user, AuthUser
from backend.api.db.client import get_supabase
from backend.api.services.ai_coach import AICoachService
from backend.api.services.decode_service import DecodeService
from backend.api.services.research_service import ResearchService
from backend.api.services.prep_service import PrepService

router = APIRouter(prefix="/api/workspaces/{workspace_id}", tags=["prep"])
coach = AICoachService()
decode_service = DecodeService()
research_service = ResearchService()
prep_service = PrepService()


async def _get_workspace(workspace_id: str, user_id: str) -> dict:
    """Fetch and verify workspace belongs to user."""
    db = get_supabase()
    resp = (
        db.table("job_workspace")
        .select("*")
        .eq("id", workspace_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(404, "Workspace not found")
    return resp.data


class RoundCreate(BaseModel):
    round_number: int
    round_type: Optional[str] = None
    round_date: Optional[str] = None
    format: Optional[str] = None
    duration_minutes: Optional[int] = None
    interviewer_type: Optional[str] = None


class DebriefCreate(BaseModel):
    round_id: Optional[str] = None
    questions_asked: list = []
    stories_used: list = []
    went_well: Optional[str] = None
    went_poorly: Optional[str] = None
    confidence_level: Optional[int] = None
    interviewer_reactions: Optional[str] = None
    overall_feeling: Optional[str] = None


@router.post("/decode")
async def decode_jd(
    workspace_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Decode the job description — extract competencies, predict rounds, identify signals."""
    workspace = await _get_workspace(workspace_id, user.id)

    if not workspace.get("jd_text"):
        raise HTTPException(400, "No job description text in this workspace. Update the workspace with jd_text first.")

    user_context = await coach.build_user_context(user.id, workspace_id)
    result = await decode_service.decode_jd(workspace["jd_text"], user_context)

    # Persist decoded data back to workspace
    db = get_supabase()
    update_data = {"status": "decoded"}
    if result.get("competency_ranking"):
        update_data["competency_ranking"] = result["competency_ranking"]
    if result.get("round_formats"):
        update_data["round_formats"] = result["round_formats"]
    if result.get("seniority_band"):
        update_data["seniority_band"] = result["seniority_band"]

    db.table("job_workspace").update(update_data).eq("id", workspace_id).execute()

    return {"decode": result}


@router.post("/research")
async def research_company(
    workspace_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Company research + fit assessment."""
    workspace = await _get_workspace(workspace_id, user.id)
    user_context = await coach.build_user_context(user.id, workspace_id)
    result = await research_service.research_company(workspace, user_context)

    # Persist research data
    db = get_supabase()
    update_data = {
        "status": "researched",
        "research_data": result,
        "date_researched": "now()",
    }
    if result.get("fit_verdict"):
        update_data["fit_verdict"] = result["fit_verdict"]
    if result.get("fit_confidence"):
        update_data["fit_confidence"] = result["fit_confidence"]
    if result.get("fit_signals"):
        update_data["fit_signals"] = str(result["fit_signals"])
    if result.get("structural_gaps"):
        update_data["structural_gaps"] = str(result["structural_gaps"])

    db.table("job_workspace").update(update_data).eq("id", workspace_id).execute()

    return {"research": result}


@router.get("/prep")
async def get_prep_brief(
    workspace_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Get or generate a prep brief for this workspace."""
    workspace = await _get_workspace(workspace_id, user.id)

    # Return cached if available
    if workspace.get("prep_brief"):
        return {"prep_brief": workspace["prep_brief"], "cached": True}

    user_context = await coach.build_user_context(user.id, workspace_id)
    result = await prep_service.generate_prep_brief(workspace, user_context)

    # Cache it
    db = get_supabase()
    db.table("job_workspace").update({"prep_brief": result}).eq("id", workspace_id).execute()

    return {"prep_brief": result, "cached": False}


@router.get("/concerns")
async def get_concerns(
    workspace_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Generate ranked interviewer concerns."""
    workspace = await _get_workspace(workspace_id, user.id)

    # Return cached if available
    if workspace.get("concerns"):
        return {"concerns": workspace["concerns"], "cached": True}

    user_context = await coach.build_user_context(user.id, workspace_id)
    result = await research_service.generate_concerns(workspace, user_context)

    db = get_supabase()
    db.table("job_workspace").update({"concerns": result.get("concerns", [])}).eq(
        "id", workspace_id
    ).execute()

    return {"concerns": result.get("concerns", []), "cached": False}


@router.get("/questions")
async def get_interviewer_questions(
    workspace_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Generate predicted interviewer questions for this company/role."""
    workspace = await _get_workspace(workspace_id, user.id)
    user_context = await coach.build_user_context(user.id, workspace_id)
    result = await research_service.generate_interviewer_questions(workspace, user_context)

    # Cache prepared questions
    if result.get("questions"):
        db = get_supabase()
        q_texts = [q.get("question", "") for q in result["questions"][:10]]
        db.table("job_workspace").update({"prepared_questions": q_texts}).eq(
            "id", workspace_id
        ).execute()

    return result


@router.post("/rounds")
async def add_round(
    workspace_id: str,
    round_data: RoundCreate,
    user: AuthUser = Depends(get_current_user),
):
    """Add an interview round to a workspace."""
    await _get_workspace(workspace_id, user.id)

    db = get_supabase()
    data = {
        "workspace_id": workspace_id,
        "user_id": user.id,
        **round_data.model_dump(exclude_none=True),
    }
    resp = db.table("interview_round").insert(data).execute()

    # Update workspace status
    db.table("job_workspace").update({"status": "interviewing"}).eq("id", workspace_id).execute()

    return resp.data[0]


@router.post("/debrief")
async def post_debrief(
    workspace_id: str,
    debrief: DebriefCreate,
    user: AuthUser = Depends(get_current_user),
):
    """Post-interview debrief with AI analysis."""
    workspace = await _get_workspace(workspace_id, user.id)

    db = get_supabase()
    debrief_data = {
        "user_id": user.id,
        **debrief.model_dump(exclude_none=True),
    }
    debrief_resp = db.table("debrief").insert(debrief_data).execute()
    saved_debrief = debrief_resp.data[0]

    # AI analysis
    user_context = await coach.build_user_context(user.id, workspace_id)
    analysis = await prep_service.process_debrief(debrief.model_dump(), workspace, user_context)

    return {"debrief": saved_debrief, "analysis": analysis}


@router.get("/hype")
async def get_hype_plan(
    workspace_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Pre-interview confidence/hype plan."""
    workspace = await _get_workspace(workspace_id, user.id)

    # Return cached if available
    if workspace.get("hype_plan"):
        return {"hype_plan": workspace["hype_plan"], "cached": True}

    user_context = await coach.build_user_context(user.id, workspace_id)
    result = await prep_service.generate_hype_plan(workspace, user_context)

    db = get_supabase()
    db.table("job_workspace").update({"hype_plan": result}).eq("id", workspace_id).execute()

    return {"hype_plan": result, "cached": False}
