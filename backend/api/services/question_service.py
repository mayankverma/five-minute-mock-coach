"""Question selection service — 4-source weighted question picking for the practice system."""

import random
from typing import Optional
from backend.api.db.client import get_supabase


# Maps drill stages to question selection strategy
STAGE_CONFIG = {
    1: {
        "name": "Ladder",
        "difficulty": "medium",
        "gate_dim": "structure",
        "gate_score": 3.5,
    },
    2: {
        "name": "Pushback",
        "difficulty": "medium",
        "gate_dim": "credibility",
        "gate_score": 3.5,
        "include_followups": True,
    },
    3: {
        "name": "Pivot",
        "difficulty": "medium",
        "gate_dim": "relevance",
        "gate_score": 3.5,
    },
    4: {
        "name": "Gap",
        "difficulty": "medium",
        "gate_dim": "credibility",
        "gate_score": 4.0,
    },
    5: {
        "name": "Role",
        "difficulty": "medium",
        "gate_dim": "substance",
        "gate_score": 4.0,
        "filter_by_role": True,
    },
    6: {
        "name": "Panel",
        "difficulty": "hard",
        "gate_dim": "all",
        "gate_score": 4.0,
    },
    7: {
        "name": "Stress",
        "difficulty": "hard",
        "gate_dim": "all",
        "gate_score": 4.0,
        "time_limit": 90,
    },
    8: {
        "name": "Technical",
        "difficulty": "hard",
        "gate_dim": "structure",
        "gate_score": 4.5,
        "include_followups": True,
    },
}


# Weighted profiles for the 4 question sources:
#   bank  = Source A: question bank (may include company overlay)
#   job   = Source B: workspace prepared_questions
#   story = Source C: story_question table (story-linked practice)
#   gap   = Source D: gap_question table (identified skill gaps)
SOURCE_WEIGHTS = {
    "no_context": {
        "bank": 1.0,
        "job": 0.0,
        "story": 0.0,
        "gap": 0.0,
    },
    "has_stories": {
        "bank": 0.5,
        "job": 0.0,
        "story": 0.3,
        "gap": 0.2,
    },
    "has_workspace": {
        "bank": 0.25,
        "job": 0.4,
        "story": 0.2,
        "gap": 0.15,
    },
    "interview_soon": {
        "bank": 0.1,
        "job": 0.6,
        "story": 0.2,
        "gap": 0.1,
    },
}


class QuestionService:
    """Selects questions based on user context, workspace, drill stage, and history.

    Sources:
      A (bank)  — main question table, optionally filtered by company overlay
      B (job)   — prepared_questions stored in the job_workspace record
      C (story) — story_question table rows linked to the user's stories
      D (gap)   — gap_question table rows for identified skill gaps
    """

    async def get_questions(
        self,
        user_id: str,
        workspace_id: Optional[str] = None,
        theme: Optional[str] = None,
        difficulty: Optional[str] = None,
        count: int = 3,
        stage: Optional[int] = None,
        source_filter: Optional[str] = None,
    ) -> list[dict]:
        """Select questions using 4-source weighted sampling.

        Args:
            user_id: The authenticated user's ID.
            workspace_id: Optional job workspace to pull context from.
            theme: Optional theme filter for bank questions.
            difficulty: Override difficulty (stage config takes precedence).
            count: Number of questions to return.
            stage: Practice stage (1-8); drives difficulty/filter overrides.
            source_filter: Force a single source ('bank'|'job'|'story'|'gap').

        Returns:
            List of question dicts, each with _source and _source_detail fields.
        """
        db = get_supabase()

        # Apply stage config overrides
        stage_cfg = {}
        if stage and stage in STAGE_CONFIG:
            stage_cfg = STAGE_CONFIG[stage]
            difficulty = difficulty or stage_cfg.get("difficulty")

        # Determine context weights
        context = await self._determine_context(user_id, workspace_id, db)
        weights = SOURCE_WEIGHTS[context]

        # Get recently practiced question IDs for de-weighting
        recent_resp = (
            db.table("user_question_history")
            .select("question_id")
            .eq("user_id", user_id)
            .order("last_practiced", desc=True)
            .limit(30)
            .execute()
        )
        recent_ids = set(r["question_id"] for r in (recent_resp.data or []))

        # Collect 3x candidate pool from all active sources
        target = count * 3
        candidates: list[dict] = []

        if source_filter:
            # Forced single source
            source_map = {
                "bank": self._get_bank_questions,
                "job": self._get_job_questions,
                "story": self._get_story_questions,
                "gap": self._get_gap_questions,
            }
            if source_filter in source_map:
                fn = source_map[source_filter]
                if source_filter == "bank":
                    items = await fn(
                        db, user_id, workspace_id, theme, difficulty,
                        stage_cfg, target
                    )
                elif source_filter == "job":
                    items = await fn(db, workspace_id, target)
                elif source_filter == "story":
                    items = await fn(db, user_id, target)
                else:
                    items = await fn(db, user_id, target)
                candidates.extend(items)
        else:
            # Gather from each source proportionally
            for source, weight in weights.items():
                if weight <= 0:
                    continue
                source_count = max(1, int(target * weight))
                if source == "bank":
                    items = await self._get_bank_questions(
                        db, user_id, workspace_id, theme, difficulty,
                        stage_cfg, source_count
                    )
                elif source == "job":
                    items = await self._get_job_questions(
                        db, workspace_id, source_count
                    )
                elif source == "story":
                    items = await self._get_story_questions(
                        db, user_id, source_count
                    )
                elif source == "gap":
                    items = await self._get_gap_questions(
                        db, user_id, source_count
                    )
                else:
                    items = []
                candidates.extend(items)

        if not candidates:
            return []

        # Deduplicate by id (prefer first occurrence to preserve source ordering)
        seen_ids: set[str] = set()
        unique_candidates: list[dict] = []
        for q in candidates:
            qid = q.get("id") or q.get("_synthetic_id")
            if qid and qid not in seen_ids:
                seen_ids.add(qid)
                unique_candidates.append(q)
            elif not qid:
                unique_candidates.append(q)

        # Assign sampling weights: recently practiced get 0.1x multiplier
        def _sample_weight(q: dict) -> float:
            qid = q.get("id") or q.get("_synthetic_id", "")
            base = 1.0
            if qid in recent_ids:
                base *= 0.1
            # Boost high-frequency bank questions
            freq = q.get("frequency")
            if freq == "very_high":
                base *= 1.5
            elif freq == "high":
                base *= 1.2
            return base

        sample_weights = [_sample_weight(q) for q in unique_candidates]

        # Weighted sampling without replacement
        selected: list[dict] = []
        pool = list(range(len(unique_candidates)))
        pool_weights = list(sample_weights)

        while len(selected) < count and pool:
            total = sum(pool_weights)
            if total <= 0:
                break
            r = random.uniform(0, total)
            cumulative = 0.0
            chosen_idx = 0
            for i, w in zip(pool, pool_weights):
                cumulative += w
                if r <= cumulative:
                    chosen_idx = i
                    break
            selected.append(unique_candidates[chosen_idx])
            # Remove chosen from pool
            pos = pool.index(chosen_idx)
            pool.pop(pos)
            pool_weights.pop(pos)

        return selected

    async def _determine_context(
        self,
        user_id: str,
        workspace_id: Optional[str],
        db,
    ) -> str:
        """Determine which SOURCE_WEIGHTS profile to use.

        Returns one of: 'no_context', 'has_stories', 'has_workspace', 'interview_soon'
        """
        # Check if workspace has an imminent interview (within 14 days)
        if workspace_id:
            ws_resp = (
                db.table("job_workspace")
                .select("next_round_date")
                .eq("id", workspace_id)
                .maybe_single()
                .execute()
            )
            if ws_resp.data and ws_resp.data.get("next_round_date"):
                from datetime import date, datetime
                next_round = ws_resp.data["next_round_date"]
                if isinstance(next_round, str):
                    try:
                        next_round = datetime.fromisoformat(next_round).date()
                    except ValueError:
                        next_round = None
                if next_round and isinstance(next_round, date):
                    days_until = (next_round - date.today()).days
                    if 0 <= days_until <= 14:
                        return "interview_soon"
            # Workspace exists but interview not imminent
            return "has_workspace"

        # Check if user has any stories
        story_resp = (
            db.table("story")
            .select("id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if story_resp.data:
            return "has_stories"

        return "no_context"

    async def _get_bank_questions(
        self,
        db,
        user_id: str,
        workspace_id: Optional[str],
        theme: Optional[str],
        difficulty: Optional[str],
        stage_cfg: dict,
        limit: int,
    ) -> list[dict]:
        """Source A: query question table with optional company overlay priority."""
        company_ids: list[str] = []

        # Company overlay: find questions mapped to this workspace's company
        if workspace_id:
            ws_resp = (
                db.table("job_workspace")
                .select("company_name")
                .eq("id", workspace_id)
                .maybe_single()
                .execute()
            )
            if ws_resp.data and ws_resp.data.get("company_name"):
                company_key = (
                    ws_resp.data["company_name"].lower().replace(" ", "_")
                )
                cq_resp = (
                    db.table("question_company_map")
                    .select("question_id")
                    .eq("company_key", company_key)
                    .limit(limit * 2)
                    .execute()
                )
                company_ids = [r["question_id"] for r in (cq_resp.data or [])]

        # Build base query
        query = db.table("question").select("*")
        if theme:
            query = query.eq("theme", theme)
        if difficulty:
            query = query.eq("difficulty", difficulty)
        if stage_cfg.get("filter_by_role"):
            # Role filter: only "role" or "behavioral" theme questions
            query = query.in_("theme", ["role", "behavioral"])

        results: list[dict] = []

        # Priority batch: company-mapped questions
        if company_ids:
            priority_resp = (
                db.table("question")
                .select("*")
                .in_("id", company_ids[:limit])
                .execute()
            )
            for q in priority_resp.data or []:
                q["_source"] = "bank"
                q["_source_detail"] = self._bank_detail(q, company=True)
                results.append(q)

        if len(results) < limit:
            remaining = limit - len(results)
            exclude = [q["id"] for q in results]
            fill_query = query.limit(remaining)
            if exclude:
                fill_query = fill_query.not_.in_("id", exclude)
            fill_resp = fill_query.execute()
            for q in fill_resp.data or []:
                q["_source"] = "bank"
                q["_source_detail"] = self._bank_detail(q, company=False)
                results.append(q)

        return results

    def _bank_detail(self, question: dict, company: bool = False) -> str:
        """Build a human-readable source detail string for a bank question."""
        parts = []
        if company:
            parts.append("company-overlay")
        theme = question.get("theme")
        if theme:
            parts.append(f"theme:{theme}")
        difficulty = question.get("difficulty")
        if difficulty:
            parts.append(f"difficulty:{difficulty}")
        return "bank/" + "/".join(parts) if parts else "bank"

    async def _get_job_questions(
        self,
        db,
        workspace_id: Optional[str],
        limit: int,
    ) -> list[dict]:
        """Source B: read prepared_questions from job_workspace and synthesise dicts."""
        if not workspace_id:
            return []

        ws_resp = (
            db.table("job_workspace")
            .select("id, company_name, prepared_questions")
            .eq("id", workspace_id)
            .maybe_single()
            .execute()
        )
        if not ws_resp.data:
            return []

        raw = ws_resp.data.get("prepared_questions") or []
        company = ws_resp.data.get("company_name", "")

        results: list[dict] = []
        for i, item in enumerate(raw[:limit]):
            if isinstance(item, str):
                text = item
                tags: list[str] = []
            elif isinstance(item, dict):
                text = item.get("question") or item.get("text") or str(item)
                tags = item.get("tags") or []
            else:
                continue

            synthetic_id = f"job_{workspace_id}_{i}"
            q: dict = {
                "id": synthetic_id,
                "_synthetic_id": synthetic_id,
                "text": text,
                "source": "job",
                "tags": tags,
                "_source": "job",
                "_source_detail": f"job/workspace:{workspace_id}/company:{company}",
            }
            results.append(q)

        return results

    async def _get_story_questions(
        self,
        db,
        user_id: str,
        limit: int,
    ) -> list[dict]:
        """Source C: query story_question joined with story for this user."""
        results: list[dict] = []

        # Attempt PostgREST join first
        try:
            sq_resp = (
                db.table("story_question")
                .select("*, story!inner(title, user_id)")
                .eq("story.user_id", user_id)
                .limit(limit)
                .execute()
            )
            rows = sq_resp.data or []
            if rows:
                for row in rows:
                    story_info = row.get("story") or {}
                    story_title = story_info.get("title", "") if isinstance(story_info, dict) else ""
                    row["_source"] = "story"
                    row["_source_detail"] = f"story/story_title:{story_title}"
                    results.append(row)
                return results
        except Exception:
            pass  # Fall through to two-query approach

        # Fallback: two-query approach
        story_resp = (
            db.table("story")
            .select("id, title")
            .eq("user_id", user_id)
            .execute()
        )
        story_rows = story_resp.data or []
        if not story_rows:
            return []

        story_id_map = {s["id"]: s.get("title", "") for s in story_rows}
        story_ids = list(story_id_map.keys())

        sq_resp = (
            db.table("story_question")
            .select("*")
            .in_("story_id", story_ids)
            .limit(limit)
            .execute()
        )
        for row in sq_resp.data or []:
            title = story_id_map.get(row.get("story_id"), "")
            row["_source"] = "story"
            row["_source_detail"] = f"story/story_title:{title}"
            results.append(row)

        return results

    async def _get_gap_questions(
        self,
        db,
        user_id: str,
        limit: int,
    ) -> list[dict]:
        """Source D: query gap_question table for identified skill gaps."""
        gq_resp = (
            db.table("gap_question")
            .select("*")
            .eq("user_id", user_id)
            .limit(limit)
            .execute()
        )
        results: list[dict] = []
        for row in gq_resp.data or []:
            gap_dim = row.get("dimension") or row.get("gap_dimension") or "unknown"
            row["_source"] = "gap"
            row["_source_detail"] = f"gap/dimension:{gap_dim}"
            results.append(row)
        return results

    async def get_shuffle_variation(
        self,
        question: dict,
        user_id: str,
        workspace_id: Optional[str] = None,
    ) -> Optional[str]:
        """Return an unused variation text from a question's variations array.

        Checks user_question_history to find which variations have been used,
        then picks one at random from the remainder.

        Args:
            question: Question dict with optional 'variations' list.
            user_id: The authenticated user's ID.
            workspace_id: Optional workspace context (unused currently).

        Returns:
            A variation string, or None if no unused variations exist.
        """
        variations = question.get("variations") or []
        if not variations:
            return None

        db = get_supabase()
        qid = question.get("id")
        if not qid:
            return random.choice(variations)

        # Find used variations stored in history
        hist_resp = (
            db.table("user_question_history")
            .select("used_variations")
            .eq("user_id", user_id)
            .eq("question_id", qid)
            .maybe_single()
            .execute()
        )
        used: list[str] = []
        if hist_resp.data and hist_resp.data.get("used_variations"):
            used = hist_resp.data["used_variations"]

        unused = [v for v in variations if v not in used]
        if not unused:
            # All variations exhausted — reset and start over
            unused = list(variations)

        return random.choice(unused)

    async def get_random_question(
        self,
        user_id: str,
        workspace_id: Optional[str] = None,
    ) -> Optional[dict]:
        """Get a single context-aware random question."""
        questions = await self.get_questions(
            user_id, workspace_id=workspace_id, count=1
        )
        return questions[0] if questions else None

    async def record_history(
        self,
        user_id: str,
        question_id: str,
        workspace_id: Optional[str] = None,
        score_avg: Optional[float] = None,
        source: str = "practice",
    ) -> dict:
        """Upsert a practice record into user_question_history."""
        db = get_supabase()

        try:
            existing = (
                db.table("user_question_history")
                .select("id, times_practiced")
                .eq("user_id", user_id)
                .eq("question_id", question_id)
                .maybe_single()
                .execute()
            )
            existing_data = existing.data if existing else None
        except Exception:
            existing_data = None

        if existing_data:
            update_data: dict = {
                "times_practiced": existing_data["times_practiced"] + 1,
                "last_practiced": "now()",
                "source": source,
            }
            if score_avg is not None:
                update_data["score_avg"] = score_avg
            if workspace_id:
                update_data["workspace_id"] = workspace_id
            resp = (
                db.table("user_question_history")
                .update(update_data)
                .eq("id", existing_data["id"])
                .execute()
            )
            return resp.data[0]
        else:
            insert_data: dict = {
                "user_id": user_id,
                "question_id": question_id,
                "source": source,
            }
            if workspace_id:
                insert_data["workspace_id"] = workspace_id
            if score_avg is not None:
                insert_data["score_avg"] = score_avg
            resp = (
                db.table("user_question_history")
                .insert(insert_data)
                .execute()
            )
            return resp.data[0]
