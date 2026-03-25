"""Five Minute Mock Coach — FastAPI application."""
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from backend.config import settings
from backend.api.routers import auth, questions, practice, stories, workspaces, prep, progress, materials, billing, voice, resume

app = FastAPI(title="Five Minute Mock Coach", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers — registered FIRST so they take priority
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
app.include_router(resume.router)


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.ENV}


# Serve frontend static files in production
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIR.exists():
    # Serve /assets/* static files
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="static-assets")

    # Custom 404 handler: serve index.html for non-API routes (SPA fallback)
    @app.exception_handler(StarletteHTTPException)
    async def spa_fallback(request: Request, exc: StarletteHTTPException):
        # Only serve SPA for 404s on non-API routes
        if exc.status_code == 404 and not request.url.path.startswith("/api/"):
            return FileResponse(FRONTEND_DIR / "index.html")
        # Return JSON for API 404s and other HTTP errors
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail or "Not found"},
        )

    # Serve root index.html
    @app.get("/")
    async def serve_root():
        return FileResponse(FRONTEND_DIR / "index.html")

    # Serve favicon and other root-level static files
    @app.get("/{filename}")
    async def serve_root_files(filename: str):
        file_path = FRONTEND_DIR / filename
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIR / "index.html")
