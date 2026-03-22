"""Story coaching service — AI-assisted story improvement, gap analysis, narrative identity."""

import json
from typing import Optional
from backend.api.services.ai_coach import AICoachService


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

    async def analyze_gaps(self, stories: list[dict], user_context: dict) -> dict:
        """Identify missing story types based on target roles and competencies."""
        story_summary = "\n".join(
            f"- {s.get('title', '?')} (skill: {s.get('primary_skill', '?')}, "
            f"secondary: {s.get('secondary_skill', '?')}, strength: {s.get('strength', '?')})"
            for s in stories
        )

        target_roles = user_context.get("profile", {}).get("target_roles", [])
        message = (
            f"## Current Storybank ({len(stories)} stories)\n{story_summary}\n\n"
            f"## Target Roles\n{', '.join(target_roles) if target_roles else 'Not specified'}\n\n"
            f"## Instructions\n"
            f"Analyze the storybank for gaps. Return JSON with:\n"
            f"- missing_categories: list of story categories that are missing "
            f"(leadership, conflict, failure, achievement, innovation, teamwork, growth, customer)\n"
            f"- stale_stories: list of story titles that may need refreshing\n"
            f"- concentration_risk: whether too many stories come from one company/domain\n"
            f"- seniority_mismatch: whether stories match the target seniority level\n"
            f"- recommendations: list of 3-5 specific story suggestions to develop\n"
            f"- coverage_score: 1-10 rating of how well-covered the target competencies are"
        )
        raw = await self.coach.coach_json("story_gaps", user_context, message)
        return json.loads(raw)

    async def narrative_analysis(self, stories: list[dict], user_context: dict) -> dict:
        """Analyze the user's narrative identity across their storybank."""
        story_summary = "\n".join(
            f"- {s.get('title', '?')}: {s.get('situation', '')[:100]}... "
            f"(skill: {s.get('primary_skill', '?')}, earned_secret: {s.get('earned_secret', 'none')[:80]})"
            for s in stories
        )

        message = (
            f"## Storybank for Narrative Analysis\n{story_summary}\n\n"
            f"## Instructions\n"
            f"Analyze the candidate's narrative identity — the overarching theme that connects "
            f"their stories. Return JSON with:\n"
            f"- narrative_theme: one sentence describing the candidate's core professional identity\n"
            f"- recurring_strengths: list of strengths that appear across multiple stories\n"
            f"- earned_secrets_summary: the most powerful earned secrets and their themes\n"
            f"- positioning_recommendation: how to frame this narrative in interviews\n"
            f"- consistency_issues: any contradictions or gaps in the narrative\n"
            f"- elevator_pitch: a 30-second pitch synthesizing the narrative"
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
