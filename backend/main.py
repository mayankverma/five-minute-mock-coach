"""Five Minute Mock Coach — FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.api.routers import auth

app = FastAPI(title="Five Minute Mock Coach", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.ENV}
