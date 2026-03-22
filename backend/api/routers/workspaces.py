"""Job workspace CRUD endpoints with free-tier gating."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from backend.api.auth import get_current_user, check_workspace_limit, AuthUser
from backend.api.db.client import get_supabase

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


class WorkspaceCreate(BaseModel):
    company_name: str
    role_title: Optional[str] = None
    jd_text: Optional[str] = None
    seniority_band: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    company_name: Optional[str] = None
    role_title: Optional[str] = None
    jd_text: Optional[str] = None
    status: Optional[str] = None
    seniority_band: Optional[str] = None
    next_round_date: Optional[str] = None


@router.get("")
async def list_workspaces(
    user: AuthUser = Depends(get_current_user),
    include_archived: bool = Query(False),
):
    """List user's job workspaces."""
    db = get_supabase()
    query = (
        db.table("job_workspace")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
    )
    if not include_archived:
        query = query.neq("status", "archived")

    resp = query.execute()
    return {"workspaces": resp.data or [], "count": len(resp.data or [])}


@router.post("")
async def create_workspace(
    ws: WorkspaceCreate,
    user: AuthUser = Depends(get_current_user),
):
    """Create a job workspace. Free users are limited to 1 active workspace."""
    await check_workspace_limit(user.id)

    db = get_supabase()
    data = {"user_id": user.id, **ws.model_dump(exclude_none=True)}
    resp = db.table("job_workspace").insert(data).execute()
    return resp.data[0]


@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Get a single workspace."""
    db = get_supabase()
    resp = (
        db.table("job_workspace")
        .select("*")
        .eq("id", workspace_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(404, "Workspace not found")
    return resp.data


@router.put("/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    ws: WorkspaceUpdate,
    user: AuthUser = Depends(get_current_user),
):
    """Update a workspace."""
    db = get_supabase()
    existing = (
        db.table("job_workspace")
        .select("id")
        .eq("id", workspace_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(404, "Workspace not found")

    update_data = ws.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(400, "No fields to update")

    resp = db.table("job_workspace").update(update_data).eq("id", workspace_id).execute()
    return resp.data[0]


@router.delete("/{workspace_id}")
async def archive_workspace(
    workspace_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Archive a workspace (soft delete)."""
    db = get_supabase()
    existing = (
        db.table("job_workspace")
        .select("id")
        .eq("id", workspace_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(404, "Workspace not found")

    db.table("job_workspace").update({"status": "archived"}).eq("id", workspace_id).execute()
    return {"status": "archived", "id": workspace_id}
