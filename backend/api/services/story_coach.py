"""Story coaching service — AI-assisted story improvement, gap analysis, narrative identity."""

import json
from typing import Optional
from backend.api.services.ai_coach import AICoachService


UNIVERSAL_CATEGORIES = [
    "leadership", "conflict", "failure", "achievement",
    "innovation", "teamwork", "growth", "customer",
]


class StoryCoachService:
    """Uses storybank_guide and differentiation prompts for AI story coaching."""

    def __init__(self):
        self.coach = AICoachService()

    async def improve_story(self, story: dict, user_context: dict) -> dict:
        """AI-assisted story improvement — returns before/after with suggestions."""
        message = (
            f"## Story to Improve\n"
            f"**Title:** {story.get('title', 'Untitled')}\n"
            f"**Situation:** {story.get('situation', 'N/A')}\n"
            f"**Task:** {story.get('task', 'N/A')}\n"
            f"**Action:** {story.get('action', 'N/A')}\n"
            f"**Result:** {story.get('result', 'N/A')}\n"
            f"**Primary Skill:** {story.get('primary_skill', 'N/A')}\n"
            f"**Earned Secret:** {story.get('earned_secret', 'None yet')}\n\n"
            f"## Instructions\n"
            f"Analyze this story and return JSON with:\n"
            f"- improved_situation, improved_task, improved_action, improved_result: "
            f"rewritten STAR components with better specifics and metrics\n"
            f"- suggested_earned_secret: an earned secret extracted or suggested\n"
            f"- strength_rating: 1-5 rating of story strength\n"
            f"- feedback: 2-3 sentences of coaching on what changed and why\n"
            f"- missing_elements: list of what's missing (metrics, specifics, etc.)"
        )
        raw = await self.coach.coach_json("story_improve", user_context, message)
        return json.loads(raw)

    def compute_basic_coverage(self, stories: list[dict]) -> dict:
        """Deterministic coverage check against universal categories. No AI needed."""
        skills = set()
        for s in stories:
            ps = (s.get("primary_skill") or "").lower()
            ss = (s.get("secondary_skill") or "").lower()
            for cat in UNIVERSAL_CATEGORIES:
                if cat in ps or cat in ss:
                    skills.add(cat)
                # Fuzzy matching for common variants
                if "lead" in ps or "influence" in ps:
                    skills.add("leadership")
                if "collaborat" in ps or "team" in ps:
                    skills.add("teamwork")
                if "problem" in ps or "innovat" in ps:
                    skills.add("innovation")
                if "customer" in ps or "stakeholder" in ps:
                    skills.add("customer")
                if "fail" in ps or "mistake" in ps:
                    skills.add("failure")
                if "conflict" in ps or "difficult" in ps:
                    skills.add("conflict")
                if "grow" in ps or "learn" in ps:
                    skills.add("growth")
                if "achiev" in ps or "impact" in ps or "deliver" in ps:
                    skills.add("achievement")

        covered = [c for c in UNIVERSAL_CATEGORIES if c in skills]
        missing = [c for c in UNIVERSAL_CATEGORIES if c not in skills]
        return {
            "covered": covered,
            "missing": missing,
            "coverage_score": round(len(covered) / len(UNIVERSAL_CATEGORIES) * 10),
        }

    async def analyze_gaps(self, stories: list[dict], user_context: dict, workspace: dict | None = None) -> dict:
        """Context-aware gap analysis. Returns structured gaps with severity and handling patterns."""
        story_summary = "\n".join(
            f"- {s.get('title', '?')} (primary_skill: {s.get('primary_skill', '?')}, "
            f"secondary_skill: {s.get('secondary_skill', '?')}, strength: {s.get('strength', '?')}, "
            f"domain: {s.get('domain', '?')})"
            for s in stories
        )

        # Build context about what we know
        context_sections = [f"## Current Storybank ({len(stories)} stories)\n{story_summary}"]

        target_roles = user_context.get("profile", {}).get("target_roles", [])
        if target_roles:
            context_sections.append(f"## Target Roles\n{', '.join(target_roles)}")

        if workspace:
            ws_info = (
                f"## Active Job Workspace\n"
                f"Company: {workspace.get('company_name', 'Unknown')}\n"
                f"Role: {workspace.get('role_title', 'Unknown')}\n"
                f"Seniority: {workspace.get('seniority_band', 'Unknown')}\n"
            )
            jd = workspace.get("jd_text", "")
            if jd:
                ws_info += f"Job Description:\n{jd[:3000]}\n"
            competencies = workspace.get("competency_ranking", [])
            if competencies:
                ws_info += f"Extracted Competencies (priority order): {json.dumps(competencies)}\n"
            context_sections.append(ws_info)

        instructions = (
            "## Instructions\n"
            "Analyze the storybank for gaps and return JSON with:\n"
            "- mapped_stories: array of {story_id, title, competency, fit_level} where fit_level is "
            "'strong' (primary skill matches, strength 4+), 'workable' (secondary match or strength 3), "
            "or 'stretch' (reframeable with guidance)\n"
            "- gaps: array of {competency, severity, reason, handling_pattern, recommendation, closest_story} where:\n"
            "  - severity is 'critical' (definitely tested, no story), 'important' (likely, only weak coverage), "
            "or 'nice_to_have' (might come up)\n"
            "  - handling_pattern is 'build_new' (no story at all), 'reframe_existing' (existing story can be reframed), "
            "'adjacent_bridge' (secondary skill covers it), or 'growth_narrative' (known development area)\n"
            "  - closest_story is {id, title, fit_level} if an existing story partially covers this, else null\n"
            "  - recommendation is a specific, actionable suggestion\n"
            "- coverage_score: 1-10 rating\n"
            "- concentration_risk: string describing any domain concentration issue, or null\n"
        )

        if workspace and workspace.get("jd_text"):
            instructions += (
                "\nIMPORTANT: Prioritize gaps based on the job description. "
                "Competencies mentioned multiple times or listed as requirements are 'critical'. "
                "Competencies mentioned once or implied are 'important'. "
                "General competencies not in the JD are 'nice_to_have'.\n"
            )
        else:
            instructions += (
                "\nNo specific job description provided. Use the 8 universal story categories "
                "(leadership, conflict, failure, achievement, innovation, teamwork, growth, customer) "
                "to assess coverage. Mark all missing categories as 'important' severity.\n"
            )

        context_sections.append(instructions)
        message = "\n\n".join(context_sections)

        raw = await self.coach.coach_json("story_gaps", user_context, message)
        return json.loads(raw)

    async def narrative_analysis(self, stories: list[dict], user_context: dict) -> dict:
        """Analyze the user's narrative identity across their storybank."""
        story_details = "\n".join(
            f"- **{s.get('title', '?')}** (id: {s.get('id', '?')})\n"
            f"  Situation: {s.get('situation', '')[:200]}\n"
            f"  Action: {s.get('action', '')[:200]}\n"
            f"  Result: {s.get('result', '')[:200]}\n"
            f"  Skills: {s.get('primary_skill', '?')} / {s.get('secondary_skill', '?')}\n"
            f"  Earned Secret: {s.get('earned_secret', 'none')}"
            for s in stories
        )

        message = (
            f"## Storybank for Narrative Analysis\n{story_details}\n\n"
            f"## Instructions\n"
            f"Analyze the candidate's narrative identity — the deeper themes that connect "
            f"their stories. Look beyond surface skills to underlying patterns.\n\n"
            f"Return JSON with:\n"
            f"- core_themes: array of {{theme, description, story_ids}} — 2-3 dominant themes "
            f"with the story IDs that support each\n"
            f"- sharpest_edge: string — the single most distinctive theme that sets this "
            f"candidate apart (not a generic skill, but a specific pattern like "
            f"'builds systems where none existed')\n"
            f"- orphan_stories: array of {{story_id, title, suggestion}} — stories not connected "
            f"to any core theme, with suggestion to retire or strengthen\n"
            f"- fragile_themes: array of {{theme, story_count}} — themes supported by only 1 story\n"
            f"- how_to_use: string — 2-3 sentences on how to weave the narrative into interviews"
        )
        raw = await self.coach.coach_json("narrative", user_context, message)
        return json.loads(raw)

    async def discover_stories(self, user_context: dict, prompt: Optional[str] = None) -> dict:
        """Guide story discovery with targeted questions."""
        message = prompt or (
            "Help me discover new stories for my storybank. "
            "Ask me targeted questions based on my profile and existing stories."
        )
        response = await self.coach.coach("story_discover", user_context, message)
        return {"response": response}
