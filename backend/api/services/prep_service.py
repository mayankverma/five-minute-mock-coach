"""Interview prep service — prep briefs, hype plans, and debrief analysis."""

import json
from backend.api.services.ai_coach import AICoachService


class PrepService:
    """Generates prep briefs, pre-interview hype plans, and post-interview debriefs."""

    def __init__(self):
        self.coach = AICoachService()

    async def generate_prep_brief(self, workspace: dict, user_context: dict) -> dict:
        """Generate a comprehensive prep brief for a job workspace."""
        message = (
            f"## Company: {workspace.get('company_name')}\n"
            f"## Role: {workspace.get('role_title')}\n"
            f"## Fit: {workspace.get('fit_verdict', '?')} "
            f"({workspace.get('fit_confidence', '?')} confidence)\n"
            f"## Competencies: {workspace.get('competency_ranking', [])}\n"
            f"## Concerns: {workspace.get('concerns', [])}\n\n"
            f"## Instructions\n"
            f"Generate a prep brief. Return JSON with:\n"
            f"- opening_strategy: how to start each interview round\n"
            f"- story_deployment_plan: which stories to deploy for which competencies\n"
            f"- gap_mitigation: how to address structural gaps\n"
            f"- key_messages: 3-5 core messages to weave throughout\n"
            f"- danger_zones: topics to navigate carefully\n"
            f"- closing_strategy: how to end each round strongly\n"
            f"- preparation_checklist: ordered list of things to do before the interview"
        )
        raw = await self.coach.coach_json("prep", user_context, message)
        return json.loads(raw)

    async def generate_hype_plan(self, workspace: dict, user_context: dict) -> dict:
        """Generate a pre-interview confidence/hype plan."""
        message = (
            f"## Company: {workspace.get('company_name')}\n"
            f"## Role: {workspace.get('role_title')}\n"
            f"## Next Round: {workspace.get('next_round_date', 'TBD')}\n\n"
            f"## Instructions\n"
            f"Generate a pre-interview hype plan to boost confidence. Return JSON with:\n"
            f"- affirmations: 3-5 evidence-based confidence statements tied to real stories\n"
            f"- visualization: a brief visualization exercise for the interview\n"
            f"- warmup_questions: 2-3 easy questions to practice right before\n"
            f"- anxiety_reframes: reframes for common anxiety triggers\n"
            f"- power_moves: specific things to do in the first 2 minutes\n"
            f"- reminder: one sentence reminder of their strongest earned secret"
        )
        raw = await self.coach.coach_json("hype", user_context, message)
        return json.loads(raw)

    async def process_debrief(self, debrief_data: dict, workspace: dict, user_context: dict) -> dict:
        """Process a post-interview debrief for coaching insights."""
        message = (
            f"## Post-Interview Debrief\n"
            f"**Company:** {workspace.get('company_name')}\n"
            f"**Questions Asked:** {debrief_data.get('questions_asked', [])}\n"
            f"**Stories Used:** {debrief_data.get('stories_used', [])}\n"
            f"**Went Well:** {debrief_data.get('went_well', 'N/A')}\n"
            f"**Went Poorly:** {debrief_data.get('went_poorly', 'N/A')}\n"
            f"**Confidence Level:** {debrief_data.get('confidence_level', '?')}/5\n"
            f"**Interviewer Reactions:** {debrief_data.get('interviewer_reactions', 'N/A')}\n"
            f"**Overall Feeling:** {debrief_data.get('overall_feeling', 'N/A')}\n\n"
            f"## Instructions\n"
            f"Analyze this debrief. Return JSON with:\n"
            f"- assessment: overall assessment of how the interview went\n"
            f"- signals: positive and negative signals from interviewer reactions\n"
            f"- story_effectiveness: which stories worked and which didn't\n"
            f"- improvements_for_next_round: specific things to do differently\n"
            f"- new_intel: any new intelligence about the company's process\n"
            f"- calibration_note: how self-assessment compares to likely reality"
        )
        raw = await self.coach.coach_json("debrief", user_context, message)
        return json.loads(raw)
