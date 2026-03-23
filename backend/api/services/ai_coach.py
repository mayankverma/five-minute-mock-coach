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
            max_completion_tokens=2000,
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
            max_completion_tokens=2000,
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
            max_completion_tokens=2000,
            stream=True,
        )
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def build_user_context(self, user_id: str, workspace_id: Optional[str] = None) -> dict:
        """Fetch user's profile, stories, scores, and optionally workspace data from Supabase."""
        db = get_supabase()
        context: dict = {}

        # Helper: safely query a table that may not exist or have no rows
        def safe_single(table: str, select: str = "*", **filters):
            try:
                q = db.table(table).select(select)
                for k, v in filters.items():
                    q = q.eq(k, v)
                resp = q.maybe_single().execute()
                return resp.data if resp else None
            except Exception:
                return None

        def safe_list(table: str, select: str = "*", **kwargs):
            try:
                q = db.table(table).select(select)
                for k, v in kwargs.get("filters", {}).items():
                    q = q.eq(k, v)
                if "order" in kwargs:
                    q = q.order(kwargs["order"], desc=kwargs.get("desc", False))
                if "limit" in kwargs:
                    q = q.limit(kwargs["limit"])
                resp = q.execute()
                return resp.data or []
            except Exception:
                return []

        # Profile
        context["profile"] = safe_single("user_profile", user_id=user_id) or {}

        # Stories
        context["stories"] = safe_list(
            "story",
            select="title,primary_skill,secondary_skill,earned_secret,strength,use_count,domain,status",
            filters={"user_id": user_id, "status": "active"},
        )

        # Recent scores (last 10)
        context["recent_scores"] = safe_list(
            "score_entry",
            select="substance,structure,relevance,credibility,differentiation,context,hire_signal,created_at",
            filters={"user_id": user_id},
            order="created_at",
            desc=True,
            limit=10,
        )

        # Coaching strategy
        context["coaching_strategy"] = safe_single("coaching_strategy", user_id=user_id)

        # Resume analysis (if available)
        context["resume"] = safe_single(
            "resume_analysis",
            select="positioning_strengths, story_seeds, career_narrative_gaps",
            user_id=user_id,
        )

        # Workspace (if specified)
        if workspace_id:
            context["workspace"] = safe_single("job_workspace", id=workspace_id, user_id=user_id)

        return context
