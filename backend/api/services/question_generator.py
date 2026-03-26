"""Question generation service — creates practice questions from stories and resume gaps."""

import json
from typing import Optional
from backend.api.db.client import get_supabase
from backend.api.services.ai_coach import AICoachService


class QuestionGenerator:
    """Generates practice questions from stories, resume gaps, and job context."""

    def __init__(self):
        self.coach = AICoachService()

    async def generate_story_questions(
        self,
        story: dict,
        user_context: dict,
        count: int = 5,
    ) -> list[dict]:
        """Generate practice questions that test a specific story.

        Called when a story is created or updated.
        Deletes existing story_questions for this story and regenerates.
        """
        db = get_supabase()
        story_id = story["id"]

        message = (
            f"## Story\n"
            f"**Title:** {story.get('title', 'Untitled')}\n"
            f"**Primary Skill:** {story.get('primary_skill', 'N/A')}\n"
            f"**Secondary Skill:** {story.get('secondary_skill', 'N/A')}\n"
            f"**Situation:** {story.get('situation', 'N/A')}\n"
            f"**Action:** {story.get('action', 'N/A')}\n"
            f"**Result:** {story.get('result', 'N/A')}\n"
            f"**Deploy For:** {story.get('deploy_for', 'N/A')}\n"
            f"\n## Instructions\n"
            f"Generate {count} behavioral interview questions that this story could answer. "
            f"Each question should test the story from a different angle — different competencies, "
            f"framings, or levels of difficulty. For each question, also provide 2-3 variations "
            f"(alternate phrasings testing the same thing).\n\n"
            f"Return JSON array: ["
            f'{{"question_text": "...", "variations": ["...", "..."], "competency_tested": "..."}}'
            f", ...]"
        )

        raw = await self.coach.coach_json("practice", user_context, message)
        questions = json.loads(raw)

        if isinstance(questions, dict) and "questions" in questions:
            questions = questions["questions"]

        # Delete existing questions for this story
        db.table("story_question").delete().eq("story_id", story_id).execute()

        # Insert new questions
        rows = []
        for q in questions[:count]:
            rows.append({
                "story_id": story_id,
                "question_text": q.get("question_text", ""),
                "variations": q.get("variations", []),
                "competency_tested": q.get("competency_tested", ""),
            })

        if rows:
            resp = db.table("story_question").insert(rows).execute()
            return resp.data or []
        return []

    async def generate_gap_questions(
        self,
        user_id: str,
        gaps: list[str],
        user_context: dict,
        resume_analysis_id: Optional[str] = None,
        count: int = 5,
    ) -> list[dict]:
        """Generate practice questions targeting resume/story gaps.

        Called when resume analysis identifies career narrative gaps
        or story gap analysis finds missing competencies.
        """
        db = get_supabase()

        gap_list = "\n".join(f"- {g}" for g in gaps)
        message = (
            f"## Career Gaps Identified\n{gap_list}\n\n"
            f"## Instructions\n"
            f"Generate {count} behavioral interview questions that specifically target these gaps. "
            f"These are areas where the candidate lacks stories or evidence. "
            f"Questions should expose the gap so the candidate can practice handling it — "
            f"either by building a new story or practicing gap-handling patterns "
            f"(adjacent bridge, hypothetical, reframe, growth narrative).\n\n"
            f"For each question, provide 2-3 variations.\n\n"
            f"Return JSON array: ["
            f'{{"question_text": "...", "variations": ["...", "..."], "gap_targeted": "..."}}'
            f", ...]"
        )

        raw = await self.coach.coach_json("practice", user_context, message)
        questions = json.loads(raw)

        if isinstance(questions, dict) and "questions" in questions:
            questions = questions["questions"]

        # Delete existing gap questions for this user
        db.table("gap_question").delete().eq("user_id", user_id).execute()

        rows = []
        for q in questions[:count]:
            rows.append({
                "user_id": user_id,
                "resume_analysis_id": resume_analysis_id,
                "question_text": q.get("question_text", ""),
                "variations": q.get("variations", []),
                "gap_targeted": q.get("gap_targeted", ""),
            })

        if rows:
            resp = db.table("gap_question").insert(rows).execute()
            return resp.data or []
        return []

    async def generate_variations(
        self,
        question_text: str,
        user_context: dict,
        count: int = 3,
    ) -> list[str]:
        """Generate fresh variations of a question on-the-fly.

        Used as backfill when stored variations are exhausted.
        """
        message = (
            f"## Original Question\n{question_text}\n\n"
            f"## Instructions\n"
            f"Generate {count} alternative phrasings of this interview question. "
            f"Each should test the same competency but be worded differently — "
            f"as different interviewers might ask the same thing.\n\n"
            f'Return JSON array of strings: ["variation 1", "variation 2", ...]'
        )

        raw = await self.coach.coach_json("practice", user_context, message)
        variations = json.loads(raw)

        if isinstance(variations, dict) and "variations" in variations:
            variations = variations["variations"]

        return variations[:count] if isinstance(variations, list) else []
