import logging
from typing import Optional

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from schemas.auth import UserResponse
from services.user import UserService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/users", tags=["users"])

logger = logging.getLogger(__name__)


class UpdateProfileRequest(BaseModel):
    name: str | None = None


class UpdatePreferencesRequest(BaseModel):
    default_model: str | None = None
    preferences: dict | None = None
    github_bound: bool | None = None
    github_username: str | None = None


class AddApiKeyRequest(BaseModel):
    provider: str
    key: str


class BindGithubRequest(BaseModel):
    username: str | None = None


# ── Profile ──────────────────────────────────────────────────────


@router.get("/profile", response_model=UserResponse)
async def get_profile(db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    """Get current user profile"""
    profile = await UserService.get_user_profile(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return profile


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Update current user profile"""
    profile = await UserService.update_user_profile(db, current_user.id, profile_data.name)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return profile


# ── Preferences ──────────────────────────────────────────────────


@router.get("/preferences")
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Get current user preferences including default model, workspace prefs, API keys, and GitHub status"""
    return await UserService.get_preferences(db, current_user.id)


@router.put("/preferences")
async def update_preferences(
    data: UpdatePreferencesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Update current user preferences"""
    update_data = {}
    if data.default_model is not None:
        update_data["default_model"] = data.default_model
    if data.preferences is not None:
        update_data["preferences"] = data.preferences
    if data.github_bound is not None:
        update_data["github_bound"] = data.github_bound
    if data.github_username is not None:
        update_data["github_username"] = data.github_username

    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    return await UserService.update_preferences(db, current_user.id, update_data)


# ── API Keys ─────────────────────────────────────────────────────


@router.post("/api-keys")
async def add_api_key(
    data: AddApiKeyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Add or update an API key for a provider"""
    if not data.provider.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider is required")
    if not data.key.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="API key is required")

    result = await UserService.add_api_key(db, current_user.id, data.provider.strip().lower(), data.key.strip())
    return result


@router.delete("/api-keys/{provider}")
async def delete_api_key(
    provider: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Delete an API key for a provider"""
    success = await UserService.delete_api_key(db, current_user.id, provider.lower())
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    return {"detail": "API key removed"}


# ── GitHub Integration ───────────────────────────────────────────


@router.post("/github/bind")
async def bind_github(
    data: BindGithubRequest = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Bind GitHub account to current user"""
    username = ""
    if data and data.username:
        username = data.username
    elif current_user.name:
        username = current_user.name.lower().replace(" ", "")

    result = await UserService.bind_github(db, current_user.id, username)
    return {"detail": "GitHub account bound", "github_username": username}


@router.delete("/github/unbind")
async def unbind_github(
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Unbind GitHub account from current user"""
    await UserService.unbind_github(db, current_user.id)
    return {"detail": "GitHub account unbound"}