# Five Minute Mock Coach

AI-powered interview coaching platform. Full lifecycle coaching from story building to offer negotiation, with voice-powered mock interviews and persistent coaching intelligence.

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** FastAPI (Python 3.12)
- **Database:** Supabase (Postgres + Auth + Storage)
- **AI:** OpenAI API (coaching intelligence)
- **Voice:** ElevenLabs ConvAI (mock interviews)
- **Payments:** Stripe (free tier + premium)
- **Deployment:** Railway

## Project Structure

```
five-minute-mock-coach/
├── backend/               # FastAPI application
│   ├── api/
│   │   ├── routers/       # API route handlers
│   │   ├── services/      # Business logic
│   │   ├── prompts/       # Coaching methodology prompt modules
│   │   ├── models/        # Pydantic request/response schemas
│   │   └── db/            # Supabase client
│   ├── db/
│   │   ├── migrations/    # SQL migrations for Supabase
│   │   └── seed/          # Data import scripts
│   ├── tests/
│   ├── config.py
│   ├── main.py
│   └── requirements.txt
├── frontend/              # React + Vite + TypeScript
└── docs/plans/            # Implementation plans
```

## Getting Started

```bash
# Backend
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env  # fill in your keys
uvicorn backend.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## Monetization

- **Free:** Full access to 1 job workspace
- **Premium:** Unlimited job workspaces (Stripe subscription)
