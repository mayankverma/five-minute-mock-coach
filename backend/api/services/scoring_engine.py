"""Scoring engine — evaluates answers on 5 dimensions using seniority-calibrated rubric."""

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
    hire_signal: str
    feedback: str
    strongest_dimension: str
    weakest_dimension: str
    improvement_suggestion: str


class ScoringEngine:
    """Scores behavioral interview answers on 5 dimensions."""

    def __init__(self):
        self.coach = AICoachService()

    async def score_answer(
        self,
        question: str,
        answer: str,
        user_context: dict,
        self_scores: Optional[dict] = None,
    ) -> ScoreResult:
        """Score an answer using the seniority-calibrated rubric.

        Args:
            question: The interview question that was asked.
            answer: The candidate's answer (text or transcript).
            user_context: Full user context for prompt composition.
            self_scores: Optional self-assessment scores for calibration.

        Returns:
            ScoreResult with 5 dimension scores and feedback.
        """
        message_parts = [
            f"## Question\n{question}",
            f"\n## Candidate's Answer\n{answer}",
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
            "Score this answer on all 5 dimensions (1.0-5.0, use 0.5 increments). "
            "Return JSON with keys: substance, structure, relevance, credibility, "
            "differentiation, hire_signal (strong_hire/hire/mixed/no_hire), "
            "feedback (2-3 sentences of direct coaching), "
            "strongest_dimension, weakest_dimension, "
            "improvement_suggestion (single most impactful change)."
        )

        raw = await self.coach.coach_json("analyze", user_context, "\n".join(message_parts))
        data = json.loads(raw)

        return ScoreResult(
            substance=float(data.get("substance", 3.0)),
            structure=float(data.get("structure", 3.0)),
            relevance=float(data.get("relevance", 3.0)),
            credibility=float(data.get("credibility", 3.0)),
            differentiation=float(data.get("differentiation", 3.0)),
            hire_signal=data.get("hire_signal", "mixed"),
            feedback=data.get("feedback", ""),
            strongest_dimension=data.get("strongest_dimension", ""),
            weakest_dimension=data.get("weakest_dimension", ""),
            improvement_suggestion=data.get("improvement_suggestion", ""),
        )
