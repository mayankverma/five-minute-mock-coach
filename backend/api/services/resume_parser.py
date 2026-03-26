"""Resume parser — extracts structured sections from raw resume text via AI."""

import json
from backend.api.services.ai_coach import AICoachService


class ResumeParser:
    """Parses raw resume text into structured sections using AI."""

    def __init__(self):
        self.coach = AICoachService()

    async def parse_sections(self, resume_text: str, user_context: dict) -> list[dict]:
        """Parse resume text into structured sections.

        Returns a list of section dicts with keys: section_type, sort_order, content.
        """
        message = (
            f"## Resume Content\n{resume_text}\n\n"
            f"## Instructions\n"
            f"Parse this resume into structured sections. Return JSON with a "
            f"'sections' array where each section has:\n"
            f"- section_type: one of 'summary', 'experience', 'education', 'skills', 'certifications'\n"
            f"- sort_order: integer starting from 0\n"
            f"- content: structured object based on type:\n"
            f"  - summary: {{ \"text\": \"...\" }}\n"
            f"  - experience: {{ \"company\": \"...\", \"title\": \"...\", "
            f"\"start_date\": \"...\", \"end_date\": \"...\" or null, "
            f"\"location\": \"...\", \"bullets\": [\"...\"] }}\n"
            f"  - education: {{ \"institution\": \"...\", \"degree\": \"...\", "
            f"\"field\": \"...\", \"graduation_date\": \"...\", \"gpa\": null }}\n"
            f"  - skills: {{ \"categories\": [{{ \"name\": \"...\", \"skills\": [\"...\"] }}] }}\n"
            f"  - certifications: {{ \"items\": [{{ \"name\": \"...\", "
            f"\"issuer\": \"...\", \"date\": \"...\" }}] }}\n\n"
            f"Create one section per experience entry (each job is its own section). "
            f"If a section type is not present in the resume, omit it. "
            f"Preserve the original text as closely as possible — do not rewrite bullets."
        )
        raw = await self.coach.coach_json("resume", user_context, message)
        parsed = json.loads(raw)
        return parsed.get("sections", [])
