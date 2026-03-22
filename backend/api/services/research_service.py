"""Company research service — fit assessment, company intelligence, and interviewer intel."""

import json
from backend.api.services.ai_coach import AICoachService


class ResearchService:
    """Generates company research, fit assessments, and interviewer intelligence."""

    def __init__(self):
        self.coach = AICoachService()

    async def research_company(self, workspace: dict, user_context: dict) -> dict:
        """Research a company and assess candidate fit.

        Returns fit verdict, confidence, signals, structural gaps, and research data.
        """
        message = (
            f"## Company: {workspace.get('company_name', 'Unknown')}\n"
            f"## Role: {workspace.get('role_title', 'Unknown')}\n"
        )
        if workspace.get("jd_text"):
            message += f"## Job Description\n{workspace['jd_text'][:3000]}\n"

        message += (
            f"\n## Instructions\n"
            f"Research this company and assess candidate fit. Return JSON with:\n"
            f"- fit_verdict: strong / investable_stretch / long_shot / weak\n"
            f"- fit_confidence: limited / medium / high\n"
            f"- fit_signals: list of positive fit signals between candidate and role\n"
            f"- structural_gaps: list of gaps between candidate profile and role requirements\n"
            f"- company_culture: brief description of company culture and values\n"
            f"- interview_process: what to expect from their interview process\n"
            f"- talking_points: 3-5 points the candidate should emphasize\n"
            f"- questions_to_ask: 3-5 smart questions the candidate should ask"
        )
        raw = await self.coach.coach_json("research", user_context, message)
        return json.loads(raw)

    async def generate_concerns(self, workspace: dict, user_context: dict) -> dict:
        """Generate ranked interviewer concerns for a workspace."""
        message = (
            f"## Company: {workspace.get('company_name')}\n"
            f"## Role: {workspace.get('role_title')}\n"
            f"## Fit Verdict: {workspace.get('fit_verdict', 'unknown')}\n"
            f"## Structural Gaps: {workspace.get('structural_gaps', 'unknown')}\n\n"
            f"## Instructions\n"
            f"Generate the top concerns an interviewer would have about this candidate. "
            f"Return JSON with:\n"
            f"- concerns: list of objects with 'concern', 'severity' (high/medium/low), "
            f"'mitigation' (how to address it), and 'story_to_deploy' (which story type to use)"
        )
        raw = await self.coach.coach_json("concerns", user_context, message)
        return json.loads(raw)

    async def generate_interviewer_questions(self, workspace: dict, user_context: dict) -> dict:
        """Predict likely interviewer questions for a specific company/role."""
        message = (
            f"## Company: {workspace.get('company_name')}\n"
            f"## Role: {workspace.get('role_title')}\n"
            f"## Competency Ranking: {workspace.get('competency_ranking', [])}\n\n"
            f"## Instructions\n"
            f"Predict the top 10 most likely interview questions for this role. "
            f"Return JSON with:\n"
            f"- questions: list of objects with 'question', 'competency_tested', "
            f"'difficulty' (easy/medium/hard), 'round' (which round it's likely in), "
            f"'recommended_story_type' (what kind of story to deploy)"
        )
        raw = await self.coach.coach_json("concerns", user_context, message)
        return json.loads(raw)
