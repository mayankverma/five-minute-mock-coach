"""Resume analysis service — upload, analyze, and optimize resumes."""

import json
from typing import Optional
from backend.api.services.ai_coach import AICoachService
from backend.api.db.client import get_supabase
from backend.config import settings


class ResumeService:
    """Handles resume upload to Supabase Storage and AI analysis."""

    def __init__(self):
        self.coach = AICoachService()

    async def analyze_resume(self, resume_text: str, user_context: dict) -> dict:
        """Analyze a resume and return structured feedback."""
        message = (
            f"## Resume Content\n{resume_text}\n\n"
            f"## Instructions\n"
            f"Analyze this resume across 8 dimensions. Return JSON with:\n"
            f"- overall_grade: letter grade A through D\n"
            f"- positioning_strengths: what the resume communicates well\n"
            f"- likely_concerns: what an interviewer might question\n"
            f"- career_narrative_gaps: where the career story has gaps\n"
            f"- story_seeds: list of objects with 'title', 'source_bullet', 'potential_skill'\n"
            f"- ats_compatibility: 'ATS-Ready' or 'ATS-Risky' or 'ATS-Broken' with rationale\n"
            f"- recruiter_scan: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
            f"- bullet_quality: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
            f"- seniority_calibration: 'Aligned' or 'Mismatched' with rationale\n"
            f"- keyword_coverage: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
            f"- structure_layout: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
            f"- consistency_polish: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
            f"- concern_management: 'Strong' or 'Moderate' or 'Weak' with rationale\n"
            f"- top_fixes: ordered list of 5 highest-impact changes, "
            f"each with 'severity' ('red'/'amber'/'neutral'), 'dimension', 'text', 'fix'\n"
            f"- concern_mitigations: list of objects with 'concern' and 'mitigation_language'\n"
            f"- cross_surface_gaps: empty array (populated later when LinkedIn data exists)"
        )
        raw = await self.coach.coach_json("resume", user_context, message)
        return json.loads(raw)

    async def optimize_resume(self, user_context: dict) -> dict:
        """Generate AI optimization suggestions based on stored analysis."""
        db = get_supabase()
        user_id = user_context.get("profile", {}).get("user_id")
        if not user_id:
            return {"error": "No user context"}

        analysis_resp = (
            db.table("resume_analysis")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not analysis_resp.data:
            return {"error": "No resume analysis found. Upload and analyze a resume first."}

        analysis = analysis_resp.data
        message = (
            f"## Current Resume Analysis\n"
            f"Strengths: {analysis.get('positioning_strengths', 'N/A')}\n"
            f"Concerns: {analysis.get('likely_concerns', 'N/A')}\n"
            f"Top Fixes: {analysis.get('top_fixes', [])}\n\n"
            f"## Instructions\n"
            f"Generate specific resume optimization suggestions. Return JSON with:\n"
            f"- rewritten_bullets: list of objects with 'original' and 'improved' bullet points\n"
            f"- summary_suggestion: a rewritten professional summary\n"
            f"- keyword_additions: specific keywords to add and where\n"
            f"- section_reorder: suggested section ordering for maximum impact\n"
            f"- formatting_tips: any formatting changes needed"
        )
        raw = await self.coach.coach_json("resume", user_context, message)
        return json.loads(raw)

    async def save_analysis(self, user_id: str, analysis: dict, resume_url: Optional[str] = None) -> dict:
        """Persist resume analysis to database."""
        db = get_supabase()
        data = {
            "user_id": user_id,
            "positioning_strengths": analysis.get("positioning_strengths"),
            "likely_concerns": analysis.get("likely_concerns"),
            "career_narrative_gaps": analysis.get("career_narrative_gaps"),
            "story_seeds": analysis.get("story_seeds", []),
            "ats_compatibility": analysis.get("ats_compatibility"),
            "recruiter_scan": analysis.get("recruiter_scan"),
            "bullet_quality": analysis.get("bullet_quality"),
            "seniority_calibration": analysis.get("seniority_calibration"),
            "keyword_coverage": analysis.get("keyword_coverage"),
            "top_fixes": analysis.get("top_fixes", []),
        }
        if resume_url:
            data["resume_file_url"] = resume_url

        resp = db.table("resume_analysis").upsert(data, on_conflict="user_id").execute()
        return resp.data[0]
