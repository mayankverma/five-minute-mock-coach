"""Progress analyzer — aggregates scores, patterns, and calibration into a full progress report."""

from backend.api.services.pattern_detection import PatternDetectionService
from backend.api.services.calibration_engine import CalibrationEngine
from backend.api.db.client import get_supabase


class ProgressAnalyzer:
    """Generates comprehensive progress reports combining scores, patterns, and calibration."""

    def __init__(self):
        self.pattern_service = PatternDetectionService()
        self.calibration_engine = CalibrationEngine()

    async def full_report(self, user_id: str, workspace_id: str = None) -> dict:
        """Generate a full progress report."""
        db = get_supabase()

        # Score history
        query = (
            db.table("score_entry")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(50)
        )
        if workspace_id:
            query = query.eq("workspace_id", workspace_id)
        scores_resp = query.execute()
        scores = scores_resp.data or []

        # Compute averages
        dimensions = ["substance", "structure", "relevance", "credibility", "differentiation"]
        averages = {}
        for dim in dimensions:
            values = [float(s[dim]) for s in scores if s.get(dim) is not None]
            if values:
                averages[dim] = round(sum(values) / len(values), 1)

        overall_avg = round(sum(averages.values()) / max(len(averages), 1), 1) if averages else None

        # Hire signal distribution
        hire_signals = {}
        for s in scores:
            sig = s.get("hire_signal", "unknown")
            hire_signals[sig] = hire_signals.get(sig, 0) + 1

        # Pattern detection
        patterns = await self.pattern_service.detect_patterns(user_id)

        # Calibration
        calibration = await self.calibration_engine.get_calibration(user_id)

        # Drill progression
        drill_resp = (
            db.table("drill_progression")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        drill = drill_resp.data

        # Outcome log
        outcomes_resp = (
            db.table("outcome_log")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        outcomes = outcomes_resp.data or []

        return {
            "total_sessions": len(scores),
            "dimension_averages": averages,
            "overall_average": overall_avg,
            "hire_signal_distribution": hire_signals,
            "patterns": patterns,
            "calibration": calibration,
            "drill_progression": drill,
            "recent_outcomes": outcomes,
        }
