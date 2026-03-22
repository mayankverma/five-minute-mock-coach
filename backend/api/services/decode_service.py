"""JD decode service — analyzes job descriptions for competencies, requirements, and signals."""

import json
from backend.api.services.ai_coach import AICoachService


class DecodeService:
    """Decodes job descriptions into structured competency rankings and signals."""

    def __init__(self):
        self.coach = AICoachService()

    async def decode_jd(self, jd_text: str, user_context: dict) -> dict:
        """Analyze a job description and extract structured intelligence.

        Returns competency ranking, round format predictions, key signals, and concerns.
        """
        message = (
            f"## Job Description\n{jd_text}\n\n"
            f"## Instructions\n"
            f"Decode this job description. Return JSON with:\n"
            f"- competency_ranking: ordered list of top 8 competencies the role requires "
            f"(e.g., 'technical leadership', 'cross-functional collaboration')\n"
            f"- round_formats: predicted interview round types and formats "
            f"(e.g., [{{'round': 'Phone Screen', 'format': 'behavioral', 'duration': 45}}])\n"
            f"- seniority_band: detected seniority level (early/mid/senior/executive)\n"
            f"- key_signals: list of important phrases/requirements that reveal what they really want\n"
            f"- red_flags: any concerning signals in the JD\n"
            f"- culture_indicators: what the JD reveals about company culture\n"
            f"- must_have_stories: list of story types the candidate absolutely needs for this role"
        )
        raw = await self.coach.coach_json("decode", user_context, message)
        return json.loads(raw)
