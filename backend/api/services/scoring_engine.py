"""Scoring engine — evaluates answers on 5+1 dimensions with exemplar and drill."""

import json
from typing import Optional
from pydantic import BaseModel
from backend.api.services.ai_coach import AICoachService


class ScoreResult(BaseModel):
    substance: float
    structure: float
    relevance: float
    credibility: float
    differentiation: float
    presence: Optional[float] = None
    hire_signal: str
    feedback: str
    strongest_dimension: str
    weakest_dimension: str
    improvement_suggestion: str
    coaching_bullets: list[str] = []
    exemplar_answer: Optional[str] = None
    micro_drill: Optional[str] = None


class ScoringEngine:
    """Scores behavioral interview answers on 5+1 dimensions with coaching depth."""

    def __init__(self):
        self.coach = AICoachService()

    async def score_answer(
        self,
        question: str,
        answer: str,
        user_context: dict,
        self_scores: Optional[dict] = None,
        input_mode: str = "text",
    ) -> ScoreResult:
        """Score an answer with enhanced feedback including exemplar and drill."""
        message_parts = [
            f"## Question\n{question}",
            f"\n## Candidate's Answer\n{answer}",
            f"\n## Input Mode: {input_mode}",
        ]

        if self_scores:
            message_parts.append(
                f"\n## Candidate's Self-Assessment\n"
                f"Substance: {self_scores.get('substance', '?')}, "
                f"Structure: {self_scores.get('structure', '?')}, "
                f"Relevance: {self_scores.get('relevance', '?')}, "
                f"Credibility: {self_scores.get('credibility', '?')}, "
                f"Differentiation: {self_scores.get('differentiation', '?')}"
            )

        message_parts.append(
            "\n## Instructions\n"
            "Score this answer on all 5 core dimensions (1.0-5.0, use 0.5 increments). "
            "If input_mode is 'voice', also score presence (1.0-5.0). "
            "If input_mode is 'text', set presence to null.\n\n"
            "Return JSON with keys: substance, structure, relevance, credibility, "
            "differentiation, presence (float or null), "
            "hire_signal (strong_hire/hire/mixed/no_hire), "
            "feedback (2-3 sentences of direct coaching), "
            "strongest_dimension, weakest_dimension, "
            "improvement_suggestion (single most impactful change), "
            "coaching_bullets (array of 3-5 specific actionable strings), "
            "exemplar_answer (170-260 word sample answer string), "
            "micro_drill (1-minute exercise string targeting weakest dimension)."
        )

        raw = await self.coach.coach_json("practice_scoring", user_context, "\n".join(message_parts))
        data = json.loads(raw)

        return ScoreResult(
            substance=float(data.get("substance", 3.0)),
            structure=float(data.get("structure", 3.0)),
            relevance=float(data.get("relevance", 3.0)),
            credibility=float(data.get("credibility", 3.0)),
            differentiation=float(data.get("differentiation", 3.0)),
            presence=float(data["presence"]) if data.get("presence") is not None else None,
            hire_signal=data.get("hire_signal", "mixed"),
            feedback=data.get("feedback", ""),
            strongest_dimension=data.get("strongest_dimension", ""),
            weakest_dimension=data.get("weakest_dimension", ""),
            improvement_suggestion=data.get("improvement_suggestion", ""),
            coaching_bullets=data.get("coaching_bullets", []),
            exemplar_answer=data.get("exemplar_answer"),
            micro_drill=data.get("micro_drill"),
        )

    async def generate_session_debrief(
        self,
        scores: list[dict],
        questions: list[dict],
        user_context: dict,
        tier: str = "session",
        round_context: Optional[dict] = None,
    ) -> dict:
        """Generate pattern/theme debrief across multiple scored answers."""
        score_summary = []
        for i, (s, q) in enumerate(zip(scores, questions)):
            score_summary.append(
                f"Q{i+1}: {q.get('question_text', '?')[:100]}\n"
                f"  Scores: Sub={s.get('substance')}, Str={s.get('structure')}, "
                f"Rel={s.get('relevance')}, Cred={s.get('credibility')}, "
                f"Diff={s.get('differentiation')}, Hire={s.get('hire_signal')}"
            )

        message = f"## Session Scores\n" + "\n".join(score_summary)

        if tier == "round_prep" and round_context:
            message += (
                f"\n\n## Round Context\n"
                f"Company: {round_context.get('company', '?')}\n"
                f"Role: {round_context.get('role', '?')}\n"
                f"Round type: {round_context.get('round_type', '?')}\n"
                f"Key competencies: {', '.join(round_context.get('competencies', []))}"
            )

        if tier == "session":
            message += (
                "\n\n## Instructions\n"
                "Analyze patterns across these answers. Return JSON with:\n"
                "- pattern_summary (2-3 sentences identifying recurring strengths and weaknesses)\n"
                "- strongest_pattern (what they consistently do well)\n"
                "- weakest_pattern (what consistently needs work)\n"
                "- dimension_averages (object with avg for each dimension)\n"
                "- top_3_actions (array of 3 specific improvements)"
            )
        else:
            message += (
                "\n\n## Instructions\n"
                "Evaluate readiness for this interview round. Return JSON with:\n"
                "- theme_summary (2-3 sentences evaluating readiness)\n"
                "- competencies_demonstrated (array)\n"
                "- competencies_missing (array)\n"
                "- story_diversity (note on story repetition)\n"
                "- gap_identification (what interviewer would be uncertain about)\n"
                "- readiness (ready/needs_work/not_ready)\n"
                "- top_3_actions (array of 3 specific improvements)"
            )

        raw = await self.coach.coach_json("practice_scoring", user_context, message)
        return json.loads(raw)
