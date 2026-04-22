from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


def _truncate_to_72_bytes(value: str) -> str:
    """Truncate a string to 72 UTF-8 bytes (bcrypt limit).

    If the encoded form exceeds 72 bytes, we trim from the end,
    taking care not to split a multi-byte character.
    """
    encoded = value.encode("utf-8")
    if len(encoded) <= 72:
        return value
    truncated = encoded[:72]
    # Remove trailing bytes that could be part of an incomplete multi-byte char
    while truncated:
        try:
            return truncated.decode("utf-8")
        except UnicodeDecodeError:
            truncated = truncated[:-1]
    return value[:72]  # Fallback: crude character-level truncation


class RegisterRequest(BaseModel):
    """Request body for local user registration."""

    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Password (6-72 bytes, bcrypt limit)")
    name: Optional[str] = None

    @field_validator("password")
    @classmethod
    def truncate_password_to_72_bytes(cls, v: str) -> str:
        """Ensure password does not exceed 72 UTF-8 bytes (bcrypt hard limit)."""
        byte_len = len(v.encode("utf-8"))
        if byte_len > 72:
            v = _truncate_to_72_bytes(v)
        if len(v.encode("utf-8")) < 6:
            raise ValueError("Password is too short after truncation to 72 bytes")
        return v


class LoginRequest(BaseModel):
    """Request body for local user login."""

    username: str = Field(..., description="Username or email")
    password: str = Field(..., min_length=1)

    @field_validator("password")
    @classmethod
    def truncate_password_to_72_bytes(cls, v: str) -> str:
        """Ensure password does not exceed 72 UTF-8 bytes (bcrypt hard limit)."""
        byte_len = len(v.encode("utf-8"))
        if byte_len > 72:
            v = _truncate_to_72_bytes(v)
        return v


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