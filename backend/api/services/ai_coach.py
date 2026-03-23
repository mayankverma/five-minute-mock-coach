"""Core AI coaching service — wraps OpenAI calls with composed prompts."""

from typing import Optional
from openai import AsyncOpenAI
from backend.config import settings
from backend.api.services.prompt_composer import PromptComposer
from backend.api.db.client import get_supabase

_openai_client: Optional[AsyncOpenAI] = None


def get_openai() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


class AICoachService:
    """Orchestrates AI coaching calls with context-aware prompt composition."""

    async def coach(self, command: str, user_context: dict, message: str) -> str:
        """Send a coaching request to OpenAI with a composed system prompt.

        Args:
            command: Coaching command (e.g., "analyze", "practice", "story_improve").
            user_context: Runtime context (profile, stories, scores, workspace, etc.).
            message: The user's message or transcript to process.

        Returns:
            The AI coach's response text.
        """
        system_prompt = PromptComposer.compose(command, user_context)
        client = get_openai()
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
            temperature=0.7,
            max_tokens=2000,
        )
        return response.choices[0].message.content

    async def coach_json(self, command: str, user_context: dict, message: str) -> str:
        """Like coach() but requests JSON output format."""
        system_prompt = PromptComposer.compose(command, user_context)
        system_prompt += (
            "\n\n---\n\n**IMPORTANT: Respond ONLY with valid JSON. "
            "No markdown, no code fences, no explanation outside the JSON.**"
        )
        client = get_openai()
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
            temperature=0.5,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content

    async def coach_stream(self, command: str, user_context: dict, messages: list[dict]):
        """Stream OpenAI response tokens. Accepts full conversation history."""
        system_prompt = PromptComposer.compose(command, user_context)
        client = get_openai()
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "system", "content": system_prompt}] + messages,
            temperature=0.7,
            max_tokens=2000,
            stream=True,
        )
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def build_user_context(self, user_id: str, workspace_id: Optional[str] = None) -> dict:
        """Fetch user's profile, stories, scores, and optionally workspace data from Supabase."""
        db = get_supabase()
        context: dict = {}

        # Profile
        profile_resp = (
            db.table("user_profile").select("*").eq("user_id", user_id).maybe_single().execute()
        )
        context["profile"] = profile_resp.data or {}

        # Stories
        stories_resp = (
            db.table("story")
            .select("title,primary_skill,secondary_skill,earned_secret,strength,use_count,domain,status")
            .eq("user_id", user_id)
            .eq("status", "active")
            .execute()
        )
        context["stories"] = stories_resp.data or []

        # Recent scores (last 10)
        scores_resp = (
            db.table("score_entry")
            .select("substance,structure,relevance,credibility,differentiation,context,hire_signal,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        context["recent_scores"] = scores_resp.data or []

        # Coaching strategy
        strategy_resp = (
            db.table("coaching_strategy").select("*").eq("user_id", user_id).maybe_single().execute()
        )
        context["coaching_strategy"] = strategy_resp.data

        # Resume analysis (if available)
        resume_resp = (
            db.table("resume_analysis")
            .select("positioning_strengths, story_seeds, career_narrative_gaps")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        context["resume"] = resume_resp.data if resume_resp.data else None

        # Workspace (if specified)
        if workspace_id:
            ws_resp = (
                db.table("job_workspace")
                .select("*")
                .eq("id", workspace_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            context["workspace"] = ws_resp.data

        return context
