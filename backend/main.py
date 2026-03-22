"""Five Minute Mock Coach — FastAPI application."""
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.config import settings
from backend.api.routers import auth, questions, practice, stories, workspaces, prep, progress, materials, billing, voice

app = FastAPI(title="Five Minute Mock Coach", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(auth.router)
app.include_router(questions.router)
app.include_router(practice.router)
app.include_router(stories.router)
app.include_router(workspaces.router)
app.include_router(prep.router)
app.include_router(progress.router)
app.include_router(materials.router)
app.include_router(billing.router)
app.include_router(voice.router)


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.ENV}


# Serve frontend static files in production
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """Serve the SPA index.html for all non-API routes."""
        # Don't intercept API routes
        if full_path.startswith("api/") or full_path == "health":
            return
        # Serve static files if they exist
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        # Fall back to index.html for SPA routing
        return FileResponse(FRONTEND_DIR / "index.html")
