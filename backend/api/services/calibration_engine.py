"""Calibration engine — tracks self-assessment accuracy over time."""

from backend.api.db.client import get_supabase


class CalibrationEngine:
    """Compares self-scores vs coach scores to detect over/under estimation patterns."""

    async def get_calibration(self, user_id: str) -> dict:
        """Analyze self-assessment accuracy.

        Returns tendency (over/under/calibrated), per-dimension deltas,
        and coaching recommendations.
        """
        db = get_supabase()

        # Get coaching strategy for current tendency
        strategy_resp = (
            db.table("coaching_strategy")
            .select("self_assessment_tendency,primary_bottleneck")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        strategy = strategy_resp.data or {}

        # Get score history with raw feedback (contains self-scores if provided)
        scores_resp = (
            db.table("score_entry")
            .select("substance,structure,relevance,credibility,differentiation,self_delta,raw_feedback,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        scores = scores_resp.data or []

        if len(scores) < 3:
            return {
                "tendency": "unknown",
                "message": "Need at least 3 scored sessions for calibration analysis",
                "sessions_analyzed": len(scores),
            }

        # Analyze self-delta distribution
        deltas = [s["self_delta"] for s in scores if s.get("self_delta")]
        over_count = sum(1 for d in deltas if d == "over")
        under_count = sum(1 for d in deltas if d == "under")
        accurate_count = sum(1 for d in deltas if d == "accurate")
        total = len(deltas)

        if total == 0:
            tendency = strategy.get("self_assessment_tendency", "unknown")
        elif over_count / max(total, 1) > 0.5:
            tendency = "over"
        elif under_count / max(total, 1) > 0.5:
            tendency = "under"
        else:
            tendency = "calibrated"

        # Per-dimension analysis
        dimensions = ["substance", "structure", "relevance", "credibility", "differentiation"]
        dim_stats = {}
        for dim in dimensions:
            values = [float(s[dim]) for s in scores if s.get(dim) is not None]
            if values:
                dim_stats[dim] = {
                    "average": round(sum(values) / len(values), 1),
                    "recent": round(sum(values[:5]) / min(len(values), 5), 1),
                    "trend": "improving" if len(values) >= 5 and sum(values[:3]) / 3 > sum(values) / len(values) else "stable",
                }

        # Recommendations
        recommendations = []
        if tendency == "over":
            recommendations.append("Your self-assessments tend to be higher than coach scores. Focus on being more critical of your specifics and metrics.")
            recommendations.append("Before self-scoring, ask: 'Would a skeptical interviewer find this compelling?'")
        elif tendency == "under":
            recommendations.append("You tend to underrate yourself. Your answers are stronger than you think.")
            recommendations.append("Focus on recognizing your earned secrets — they're more distinctive than you realize.")
        elif tendency == "calibrated":
            recommendations.append("Your self-assessment is well-calibrated. This is a significant strength in interviews.")

        # Update coaching strategy
        db.table("coaching_strategy").upsert(
            {"user_id": user_id, "self_assessment_tendency": tendency},
            on_conflict="user_id",
        ).execute()

        return {
            "tendency": tendency,
            "sessions_analyzed": len(scores),
            "delta_distribution": {
                "over": over_count,
                "under": under_count,
                "accurate": accurate_count,
            },
            "dimension_stats": dim_stats,
            "recommendations": recommendations,
        }
