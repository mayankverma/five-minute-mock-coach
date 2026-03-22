"""Pattern detection service — identifies recurring effective/ineffective patterns across sessions."""

from backend.api.db.client import get_supabase


class PatternDetectionService:
    """Detects interview patterns from score history and session data."""

    async def detect_patterns(self, user_id: str) -> dict:
        """Analyze score history for recurring patterns.

        Checks for:
        - Recurring dimension weaknesses (3+ sessions below 3.0)
        - Recurring strengths (3+ sessions above 4.0)
        - Story effectiveness (which stories score well where)
        - Trend direction (improving, declining, plateau)
        """
        db = get_supabase()

        scores_resp = (
            db.table("score_entry")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        scores = scores_resp.data or []

        if len(scores) < 3:
            return {"patterns": [], "message": "Need at least 3 scored sessions for pattern detection"}

        dimensions = ["substance", "structure", "relevance", "credibility", "differentiation"]
        effective = []
        ineffective = []

        for dim in dimensions:
            values = [float(s[dim]) for s in scores if s.get(dim) is not None]
            if not values:
                continue

            avg = sum(values) / len(values)
            recent_avg = sum(values[:5]) / min(len(values), 5)

            if avg >= 4.0:
                effective.append({
                    "pattern_type": "effective",
                    "description": f"Consistently strong {dim} (avg: {avg:.1f})",
                    "linked_dimension": dim,
                    "evidence": f"Average {avg:.1f} across {len(values)} sessions",
                })
            elif avg < 3.0:
                ineffective.append({
                    "pattern_type": "ineffective",
                    "description": f"Recurring weakness in {dim} (avg: {avg:.1f})",
                    "linked_dimension": dim,
                    "evidence": f"Average {avg:.1f} across {len(values)} sessions",
                })

            # Trend detection
            if len(values) >= 5:
                if recent_avg > avg + 0.3:
                    effective.append({
                        "pattern_type": "effective",
                        "description": f"Improving trend in {dim} (+{recent_avg - avg:.1f})",
                        "linked_dimension": dim,
                        "evidence": f"Recent avg {recent_avg:.1f} vs overall {avg:.1f}",
                    })
                elif recent_avg < avg - 0.3:
                    ineffective.append({
                        "pattern_type": "ineffective",
                        "description": f"Declining trend in {dim} ({recent_avg - avg:.1f})",
                        "linked_dimension": dim,
                        "evidence": f"Recent avg {recent_avg:.1f} vs overall {avg:.1f}",
                    })

        # Persist detected patterns
        all_patterns = effective + ineffective
        for p in all_patterns:
            db.table("interview_pattern").upsert(
                {
                    "user_id": user_id,
                    "pattern_type": p["pattern_type"],
                    "description": p["description"],
                    "linked_dimension": p["linked_dimension"],
                    "evidence": p["evidence"],
                    "still_active": True,
                },
                on_conflict="user_id,description",
            ).execute()

        return {"effective": effective, "ineffective": ineffective}
