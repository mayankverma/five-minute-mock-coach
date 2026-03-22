"""Pitch, LinkedIn, and comp strategy services."""

import json
from backend.api.services.ai_coach import AICoachService
from backend.api.db.client import get_supabase


class PitchService:
    """Generates positioning statements, LinkedIn audits, and comp strategies."""

    def __init__(self):
        self.coach = AICoachService()

    async def generate_pitch(self, user_context: dict) -> dict:
        """Generate a positioning statement / elevator pitch."""
        stories = user_context.get("stories", [])
        story_summary = ", ".join(s.get("title", "?") for s in stories[:5]) if stories else "No stories yet"

        message = (
            f"## Instructions\n"
            f"Generate a positioning statement for this candidate. "
            f"Their stories include: {story_summary}\n\n"
            f"Return JSON with:\n"
            f"- core_statement: the full positioning statement (2-3 sentences)\n"
            f"- hook_10s: a 10-second hook version\n"
            f"- key_differentiator: what makes this candidate unique\n"
            f"- earned_secret_anchor: the earned secret that anchors their pitch\n"
            f"- target_audience: who this pitch is calibrated for\n"
            f"- variants: object with keys 'networking', 'interview_opener', 'linkedin_headline' — "
            f"each a variant of the core statement for that context"
        )
        raw = await self.coach.coach_json("pitch", user_context, message)
        return json.loads(raw)

    async def save_pitch(self, user_id: str, pitch: dict) -> dict:
        """Persist positioning statement."""
        db = get_supabase()
        data = {
            "user_id": user_id,
            "core_statement": pitch.get("core_statement"),
            "hook_10s": pitch.get("hook_10s"),
            "key_differentiator": pitch.get("key_differentiator"),
            "earned_secret_anchor": pitch.get("earned_secret_anchor"),
            "target_audience": pitch.get("target_audience"),
            "variants": pitch.get("variants", {}),
        }
        resp = db.table("positioning_statement").upsert(data, on_conflict="user_id").execute()
        return resp.data[0]

    async def audit_linkedin(self, linkedin_text: str, user_context: dict) -> dict:
        """AI LinkedIn profile audit."""
        message = (
            f"## LinkedIn Profile Content\n{linkedin_text[:4000]}\n\n"
            f"## Instructions\n"
            f"Audit this LinkedIn profile. Return JSON with:\n"
            f"- overall: overall assessment (1-2 sentences)\n"
            f"- recruiter_discoverability: how likely recruiters are to find this profile\n"
            f"- credibility_score: how credible the profile appears (low/medium/high)\n"
            f"- differentiation_score: how distinctive vs. similar professionals (low/medium/high)\n"
            f"- top_fixes: ordered list of objects with 'section', 'issue', 'fix'\n"
            f"- positioning_gaps: where the profile's positioning doesn't match target roles"
        )
        raw = await self.coach.coach_json("linkedin", user_context, message)
        return json.loads(raw)

    async def save_linkedin(self, user_id: str, analysis: dict) -> dict:
        """Persist LinkedIn analysis."""
        db = get_supabase()
        data = {
            "user_id": user_id,
            "overall": analysis.get("overall"),
            "recruiter_discoverability": analysis.get("recruiter_discoverability"),
            "credibility_score": analysis.get("credibility_score"),
            "differentiation_score": analysis.get("differentiation_score"),
            "top_fixes": analysis.get("top_fixes", []),
            "positioning_gaps": analysis.get("positioning_gaps"),
        }
        resp = db.table("linkedin_analysis").upsert(data, on_conflict="user_id").execute()
        return resp.data[0]

    async def build_comp_strategy(self, comp_data: dict, user_context: dict) -> dict:
        """Generate an AI-powered compensation strategy."""
        message = (
            f"## Compensation Context\n"
            f"Target Range: {comp_data.get('target_range', 'Not specified')}\n"
            f"Current Comp: {comp_data.get('current_comp', 'Not specified')}\n"
            f"Location: {comp_data.get('location', 'Not specified')}\n"
            f"Stage: {comp_data.get('stage', 'Not specified')}\n\n"
            f"## Instructions\n"
            f"Build a compensation negotiation strategy. Return JSON with:\n"
            f"- target_range: recommended target range (object with 'low', 'mid', 'high')\n"
            f"- range_basis: what the range is based on (market data, experience, etc.)\n"
            f"- research_completeness: how complete the candidate's research is (low/medium/high)\n"
            f"- stage_coached: current negotiation stage and next steps\n"
            f"- jurisdiction_notes: any location-specific considerations\n"
            f"- scripts: object with 'initial_ask', 'counter_offer', 'final_push' — "
            f"exact phrases to use at each stage\n"
            f"- key_principle: the single most important negotiation principle for this situation"
        )
        raw = await self.coach.coach_json("salary", user_context, message)
        return json.loads(raw)

    async def save_comp(self, user_id: str, strategy: dict) -> dict:
        """Persist comp strategy."""
        db = get_supabase()
        data = {
            "user_id": user_id,
            "target_range": strategy.get("target_range"),
            "range_basis": strategy.get("range_basis"),
            "research_completeness": strategy.get("research_completeness"),
            "stage_coached": strategy.get("stage_coached"),
            "jurisdiction_notes": strategy.get("jurisdiction_notes"),
            "scripts": strategy.get("scripts", {}),
            "key_principle": strategy.get("key_principle"),
        }
        resp = db.table("comp_strategy").upsert(data, on_conflict="user_id").execute()
        return resp.data[0]
