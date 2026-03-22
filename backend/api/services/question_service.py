"""Question selection service — context-aware question picking from the 253-question bank."""

from typing import Optional
from backend.api.db.client import get_supabase


# Maps drill stages to question selection strategy
STAGE_CONFIG = {
    1: {"difficulty": "medium", "time_limit": 120},   # Ladder: core themes, 2-min
    2: {"difficulty": "medium", "include_followups": True},  # Pushback
    3: {"difficulty": "medium"},                       # Conciseness
    4: {"difficulty": "medium"},                       # Versatility
    5: {"filter_by_role": True},                       # Role-specific
    6: {"difficulty": "hard"},                         # Curveball
    7: {"difficulty": "hard", "time_limit": 90},       # Stress: rapid-fire
    8: {"difficulty": "hard", "include_followups": True},  # Full simulation
}


class QuestionService:
    """Selects questions based on user context, workspace, drill stage, and history."""

    async def get_questions(
        self,
        user_id: str,
        workspace_id: Optional[str] = None,
        theme: Optional[str] = None,
        difficulty: Optional[str] = None,
        count: int = 3,
        stage: Optional[int] = None,
    ) -> list[dict]:
        """Select questions based on context.

        - General workspace: filter by theme, difficulty, user's seniority band
        - Job workspace: prioritize company-mapped questions, then fill with JD competencies
        - Exclude recently practiced (from user_question_history)
        - Weight by frequency (very_high questions appear more often)
        """
        db = get_supabase()

        # Get recently practiced question IDs to exclude
        recent_resp = (
            db.table("user_question_history")
            .select("question_id")
            .eq("user_id", user_id)
            .order("last_practiced", desc=True)
            .limit(20)
            .execute()
        )
        recent_ids = [r["question_id"] for r in (recent_resp.data or [])]

        # Apply stage config overrides
        if stage and stage in STAGE_CONFIG:
            config = STAGE_CONFIG[stage]
            difficulty = difficulty or config.get("difficulty")

        # If workspace specified, try company-mapped questions first
        company_questions = []
        if workspace_id:
            ws_resp = (
                db.table("job_workspace")
                .select("company_name")
                .eq("id", workspace_id)
                .maybe_single()
                .execute()
            )
            if ws_resp.data:
                company_key = ws_resp.data["company_name"].lower().replace(" ", "_")
                cq_resp = (
                    db.table("question_company_map")
                    .select("question_id")
                    .eq("company_key", company_key)
                    .limit(count * 2)
                    .execute()
                )
                company_questions = [
                    r["question_id"]
                    for r in (cq_resp.data or [])
                    if r["question_id"] not in recent_ids
                ]

        # Build main query
        query = db.table("question").select("*")

        if theme:
            query = query.eq("theme", theme)
        if difficulty:
            query = query.eq("difficulty", difficulty)
        if recent_ids:
            query = query.not_.in_("id", recent_ids)

        # Prioritize company questions
        if company_questions:
            priority_resp = (
                db.table("question").select("*").in_("id", company_questions[:count]).execute()
            )
            priority = priority_resp.data or []
            if len(priority) >= count:
                return priority[:count]
            # Fill remaining from general pool
            remaining = count - len(priority)
            query = query.not_.in_("id", [q["id"] for q in priority])
            fill_resp = query.limit(remaining).execute()
            return priority + (fill_resp.data or [])

        result = query.limit(count).execute()
        return result.data or []

    async def get_random_question(
        self,
        user_id: str,
        workspace_id: Optional[str] = None,
    ) -> Optional[dict]:
        """Get a single context-aware random question."""
        questions = await self.get_questions(user_id, workspace_id=workspace_id, count=1)
        return questions[0] if questions else None

    async def record_history(
        self,
        user_id: str,
        question_id: str,
        workspace_id: Optional[str] = None,
        score_avg: Optional[float] = None,
        source: str = "practice",
    ) -> dict:
        """Record that a user practiced a question."""
        db = get_supabase()

        # Check existing
        existing = (
            db.table("user_question_history")
            .select("id,times_practiced")
            .eq("user_id", user_id)
            .eq("question_id", question_id)
            .maybe_single()
            .execute()
        )

        if existing.data:
            update_data = {
                "times_practiced": existing.data["times_practiced"] + 1,
                "last_practiced": "now()",
                "source": source,
            }
            if score_avg is not None:
                update_data["score_avg"] = score_avg
            if workspace_id:
                update_data["workspace_id"] = workspace_id
            resp = (
                db.table("user_question_history")
                .update(update_data)
                .eq("id", existing.data["id"])
                .execute()
            )
            return resp.data[0]
        else:
            data = {
                "user_id": user_id,
                "question_id": question_id,
                "source": source,
            }
            if workspace_id:
                data["workspace_id"] = workspace_id
            if score_avg is not None:
                data["score_avg"] = score_avg
            resp = db.table("user_question_history").insert(data).execute()
            return resp.data[0]
