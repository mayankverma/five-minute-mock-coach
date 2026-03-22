"""
Seed script: Import 253 behavioral questions + company overlays from 5 Minute Mock.

Usage: cd backend && python -m db.seed.import_questions
Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SOURCE_DIR = Path(__file__).parent.parent.parent.parent / "five-minute-mock-mvp" / "web" / "data"
QUESTIONS_FILE = SOURCE_DIR / "behavioral_questions.json"
OVERLAYS_DIR = SOURCE_DIR / "technology" / "overlays"


def seed():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Error: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
        return

    client = create_client(url, key)

    if not QUESTIONS_FILE.exists():
        print(f"Error: Question file not found at {QUESTIONS_FILE}")
        return

    with open(QUESTIONS_FILE) as f:
        data = json.load(f)

    questions = []
    for q in data.get("questions", []):
        meta = q.get("meta", {})
        questions.append({
            "id": q["id"],
            "title": q["title"],
            "question_text": q["question"],
            "difficulty": q.get("difficulty", "medium"),
            "category": q.get("category", "behavioral"),
            "theme": q.get("theme"),
            "explanation": q.get("explanation"),
            "tags": q.get("tags", []),
            "frequency": q.get("frequency", "medium"),
            "time_to_answer_seconds": q.get("time_to_answer_seconds", 180),
            "variations": q.get("variations", []),
            "follow_up_questions": q.get("follow_up_questions", []),
            "levels_applicable": meta.get("levels_applicable", []),
            "roles_applicable": meta.get("roles_applicable", []),
            "guidance": q.get("question_guidance", {}),
        })

    # Upsert in batches
    batch_size = 50
    for i in range(0, len(questions), batch_size):
        batch = questions[i : i + batch_size]
        client.table("question").upsert(batch).execute()
        print(f"  Seeded questions {i + 1}-{min(i + batch_size, len(questions))}")

    print(f"Seeded {len(questions)} questions total")

    # Import company overlays
    if OVERLAYS_DIR.exists():
        for overlay_file in sorted(OVERLAYS_DIR.glob("*_overlay.json")):
            with open(overlay_file) as f:
                overlay = json.load(f)
            company_key = overlay.get(
                "company_slug", overlay_file.stem.replace("_overlay", "")
            )
            mappings = []
            for m in overlay.get("question_mappings", []):
                mappings.append({
                    "question_id": m["canonical_id"],
                    "company_key": company_key,
                    "frequency_at_company": m.get("frequency_at_company", "medium"),
                    "typical_round": m.get("typical_round"),
                    "company_specific_guidance": m.get("company_specific_guidance", {}),
                })
            if mappings:
                client.table("question_company_map").upsert(mappings).execute()
                print(f"  Seeded {len(mappings)} mappings for {company_key}")

    print("Done!")


if __name__ == "__main__":
    seed()
