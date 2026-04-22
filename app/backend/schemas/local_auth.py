from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Request body for local user registration."""

    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, max_length=128)
    name: Optional[str] = None


class LoginRequest(BaseModel):
    """Request body for local user login."""

    username: str = Field(..., description="Username or email")
    password: str = Field(..., min_length=1)


class LocalUserResponse(BaseModel):
    """Response body for local user info."""

    id: str
    username: str
    email: str
    name: Optional[str] = None
    role: str = "user"
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class LocalAuthResponse(BaseModel):
    """Response body for register/login with token."""

    token: str
    user: LocalUserResponse