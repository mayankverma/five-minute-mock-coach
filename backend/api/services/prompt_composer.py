"""Modular prompt composition for AI coaching.

Assembles system prompts from modular components:
    BASE RUBRIC + SENIORITY CALIBRATION + DIFFERENTIATION MODULE
    + COMMAND-SPECIFIC CONTEXT + USER CONTEXT + WORKSPACE CONTEXT
    = COMPOSED SYSTEM PROMPT → sent to OpenAI
"""

from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# Maps command names to which prompt modules they need
COMMAND_MODULES: dict[str, list[str]] = {
    "analyze": ["rubrics", "calibration", "transcript_processing"],
    "practice": ["rubrics", "challenge_protocol", "transcript_processing"],
    "story_improve": ["storybank_guide", "differentiation"],
    "story_gaps": ["storybank_guide", "story_mapping"],
    "story_chat": ["storybank_guide", "differentiation", "story_chat"],
    "story_discover": ["storybank_guide", "differentiation"],
    "narrative": ["storybank_guide", "differentiation", "story_mapping"],
    "decode": ["cross_cutting"],
    "research": ["cross_cutting"],
    "prep": ["cross_cutting", "story_mapping"],
    "concerns": ["challenge_protocol", "cross_cutting"],
    "hype": ["cross_cutting"],
    "debrief": ["transcript_processing", "calibration"],
    "resume": ["differentiation", "cross_cutting"],
    "pitch": ["differentiation"],
    "linkedin": ["differentiation", "cross_cutting"],
    "linkedin_chat": ["differentiation", "cross_cutting", "linkedin_chat"],
    "resume_chat": ["differentiation", "cross_cutting", "resume_chat"],
    "outreach_chat": ["differentiation", "cross_cutting", "outreach_chat"],
    "salary": ["cross_cutting"],
    "calibrate": ["calibration", "rubrics"],
    "patterns": ["calibration"],
    "progress": ["calibration", "rubrics"],
    "practice_scoring": ["rubrics", "practice_scoring", "calibration", "transcript_processing"],
    "mock_debrief": ["rubrics", "mock_debrief", "calibration"],
}


class PromptComposer:
    """Composes coaching prompts from modular .txt files and runtime context."""

    @staticmethod
    def _load_module(name: str) -> Optional[str]:
        path = PROMPTS_DIR / f"{name}.txt"
        if not path.exists():
            logger.warning(f"Prompt module not found: {name}.txt")
            return None
        return path.read_text(encoding="utf-8")

    @classmethod
    def compose(cls, command: str, user_context: dict) -> str:
        """Build a complete system prompt for a given coaching command.

        Args:
            command: The coaching command (e.g., "analyze", "practice", "story_improve").
            user_context: Dict with keys like profile, storybank, scores, workspace, etc.

        Returns:
            Assembled system prompt string.
        """
        sections: list[str] = []

        # 1. Base identity
        sections.append(
            "You are an expert behavioral interview coach. "
            "You give direct, actionable feedback calibrated to the candidate's seniority level. "
            "You never give generic advice — every suggestion must be specific to this candidate's stories, "
            "target roles, and interview context."
        )

        # 2. Load command-specific modules
        module_names = COMMAND_MODULES.get(command, ["rubrics"])
        for mod in module_names:
            content = cls._load_module(mod)
            if content:
                sections.append(f"\n---\n\n{content}")

        # 3. Seniority calibration
        seniority = (
            user_context.get("workspace", {}).get("seniority_band")
            or user_context.get("profile", {}).get("seniority_band")
            or "mid"
        )
        sections.append(
            f"\n---\n\n## Seniority Context\n"
            f"This candidate is at the **{seniority}** level. "
            f"Calibrate all scoring, expectations, and feedback to {seniority}-level norms."
        )

        # 4. User context
        profile = user_context.get("profile", {})
        if profile:
            ctx_parts = []
            if profile.get("full_name"):
                ctx_parts.append(f"Name: {profile['full_name']}")
            if profile.get("target_roles"):
                ctx_parts.append(f"Target roles: {', '.join(profile['target_roles'])}")
            if profile.get("biggest_concern"):
                ctx_parts.append(f"Biggest concern: {profile['biggest_concern']}")
            if profile.get("coaching_mode"):
                ctx_parts.append(f"Coaching mode: {profile['coaching_mode']}")
            if profile.get("feedback_directness"):
                ctx_parts.append(f"Feedback directness: {profile['feedback_directness']}/5")
            if profile.get("career_transition") and profile["career_transition"] != "none":
                ctx_parts.append(f"Career transition: {profile['career_transition']}")
            if ctx_parts:
                sections.append(
                    f"\n---\n\n## Candidate Profile\n" + "\n".join(f"- {p}" for p in ctx_parts)
                )

        # 5. Storybank summary
        stories = user_context.get("stories", [])
        if stories:
            story_lines = []
            for s in stories[:12]:
                line = f"- **{s.get('title', 'Untitled')}** (skill: {s.get('primary_skill', '?')}"
                if s.get("strength"):
                    line += f", strength: {s['strength']}/5"
                if s.get("earned_secret"):
                    line += f", earned secret: {s['earned_secret'][:80]}"
                line += ")"
                story_lines.append(line)
            sections.append(
                f"\n---\n\n## Candidate's Storybank ({len(stories)} stories)\n"
                + "\n".join(story_lines)
            )

        # 6. Resume context (if available)
        resume = user_context.get("resume")
        if resume:
            resume_parts = []
            if resume.get("positioning_strengths"):
                resume_parts.append(f"Positioning strengths: {resume['positioning_strengths']}")
            if resume.get("career_narrative_gaps"):
                resume_parts.append(f"Career narrative gaps: {resume['career_narrative_gaps']}")
            if resume.get("story_seeds"):
                import json
                seeds = resume["story_seeds"] if isinstance(resume["story_seeds"], list) else json.loads(resume["story_seeds"])
                if seeds:
                    resume_parts.append(f"Story seeds from resume: {json.dumps(seeds)}")
            if resume_parts:
                sections.append(
                    f"\n---\n\n## Resume Analysis\n" + "\n".join(f"- {p}" for p in resume_parts)
                )

        # 7. Score history summary
        scores = user_context.get("recent_scores", [])
        if scores:
            avg_lines = []
            for s in scores[-5:]:
                avg_lines.append(
                    f"- {s.get('context', '?')}: "
                    f"Sub={s.get('substance', '?')} Str={s.get('structure', '?')} "
                    f"Rel={s.get('relevance', '?')} Cred={s.get('credibility', '?')} "
                    f"Diff={s.get('differentiation', '?')}"
                )
            sections.append(
                f"\n---\n\n## Recent Score History (last {len(avg_lines)})\n"
                + "\n".join(avg_lines)
            )

        # 7. Workspace context (if in a job workspace)
        workspace = user_context.get("workspace")
        if workspace and workspace.get("company_name"):
            ws_parts = [f"Company: {workspace['company_name']}"]
            if workspace.get("role_title"):
                ws_parts.append(f"Role: {workspace['role_title']}")
            if workspace.get("status"):
                ws_parts.append(f"Status: {workspace['status']}")
            if workspace.get("fit_verdict"):
                ws_parts.append(f"Fit: {workspace['fit_verdict']} ({workspace.get('fit_confidence', '?')} confidence)")
            if workspace.get("competency_ranking"):
                top = workspace["competency_ranking"][:5]
                ws_parts.append(f"Top competencies: {', '.join(str(c) for c in top)}")
            if workspace.get("concerns"):
                ws_parts.append(f"Key concerns: {workspace['concerns'][:3]}")
            sections.append(
                f"\n---\n\n## Job Workspace Context\n" + "\n".join(f"- {p}" for p in ws_parts)
            )

        # 8. Coaching strategy
        strategy = user_context.get("coaching_strategy")
        if strategy:
            strat_parts = []
            if strategy.get("primary_bottleneck"):
                strat_parts.append(f"Primary bottleneck: {strategy['primary_bottleneck']}")
            if strategy.get("current_approach"):
                strat_parts.append(f"Current approach: {strategy['current_approach']}")
            if strategy.get("self_assessment_tendency"):
                strat_parts.append(f"Self-assessment tendency: {strategy['self_assessment_tendency']}")
            if strat_parts:
                sections.append(
                    f"\n---\n\n## Coaching Strategy\n" + "\n".join(f"- {p}" for p in strat_parts)
                )

        return "\n".join(sections)
