import logging
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from core.auth import create_access_token
from core.config import settings
from core.database import db_manager
from models.auth import OIDCState, User
from models.local_auth import LocalUser
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    import bcrypt
except ImportError:
    bcrypt = None

logger = logging.getLogger(__name__)


def _prepare_password(password: str) -> str:
    """Truncate password to 72 bytes for bcrypt compatibility.

    bcrypt only accepts passwords up to 72 bytes. We truncate at the byte
    level to guarantee the limit is never exceeded, even with multi-byte
    UTF-8 characters.
    """
    encoded = password.encode("utf-8")
    if len(encoded) <= 72:
        return password
    # Truncate to 72 bytes, then decode back carefully to avoid
    # splitting a multi-byte character at the boundary.
    truncated = encoded[:72]
    while truncated:
        try:
            return truncated.decode("utf-8")
        except UnicodeDecodeError:
            truncated = truncated[:-1]
    return ""


def _require_bcrypt():
    if bcrypt is None:
        raise RuntimeError("bcrypt is not installed. Run: pip install bcrypt")


def _hash_password(password: str) -> str:
    _require_bcrypt()
    prepared_password = _prepare_password(password).encode("utf-8")
    return bcrypt.hashpw(prepared_password, bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed_password: str) -> bool:
    _require_bcrypt()
    prepared_password = _prepare_password(password).encode("utf-8")
    return bcrypt.checkpw(prepared_password, hashed_password.encode("utf-8"))


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_user(self, platform_sub: str, email: str, name: Optional[str] = None) -> User:
        """Get existing user or create new one."""
        start_time = time.time()
        logger.debug(f"[DB_OP] Starting get_or_create_user - platform_sub: {platform_sub}")
        # Try to find existing user
        result = await self.db.execute(select(User).where(User.id == platform_sub))
        user = result.scalar_one_or_none()
        logger.debug(f"[DB_OP] User lookup completed in {time.time() - start_time:.4f}s - found: {user is not None}")

        if user:
            # Update user info if needed
            user.email = email
            user.name = name
            user.last_login = datetime.now(timezone.utc)
        else:
            # Create new user
            user = User(id=platform_sub, email=email, name=name, last_login=datetime.now(timezone.utc))
            self.db.add(user)

        start_time_commit = time.time()
        logger.debug("[DB_OP] Starting user commit/refresh")
        await self.db.commit()
        await self.db.refresh(user)
        logger.debug(f"[DB_OP] User commit/refresh completed in {time.time() - start_time_commit:.4f}s")
        return user

    async def issue_app_token(
        self,
        user: User,
    ) -> Tuple[str, datetime, Dict[str, Any]]:
        """Generate application JWT token for the authenticated user."""
        try:
            expires_minutes = int(getattr(settings, "jwt_expire_minutes", 60))
        except (TypeError, ValueError):
            logger.warning("Invalid JWT_EXPIRE_MINUTES value; fallback to 60 minutes")
            expires_minutes = 60
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)

        claims: Dict[str, Any] = {
            "sub": user.id,
            "email": user.email,
            "role": user.role,
        }

        if user.name:
            claims["name"] = user.name
        if user.last_login:
            claims["last_login"] = user.last_login.isoformat()
        token = create_access_token(claims, expires_minutes=expires_minutes)

        return token, expires_at, claims

    async def register_local_user(
        self, username: str, email: str, password: str, name: Optional[str] = None
    ) -> Tuple[LocalUser, str]:
        """Register a new local user with username and password."""
        # Check if username already exists
        result = await self.db.execute(select(LocalUser).where(LocalUser.username == username))
        if result.scalar_one_or_none():
            raise ValueError("Username already exists")

        # Check if email already exists
        result = await self.db.execute(select(LocalUser).where(LocalUser.email == email))
        if result.scalar_one_or_none():
            raise ValueError("Email already exists")

        # Create local user
        hashed_password = _hash_password(password)
        local_user = LocalUser(
            id=str(uuid.uuid4()),
            username=username,
            email=email,
            hashed_password=hashed_password,
            name=name or username,
            role="user",
        )
        self.db.add(local_user)

        # Also create a corresponding User record for app compatibility
        result = await self.db.execute(select(User).where(User.id == local_user.id))
        app_user = result.scalar_one_or_none()
        if not app_user:
            app_user = User(
                id=local_user.id,
                email=email,
                name=name or username,
                role="user",
                last_login=datetime.now(timezone.utc),
            )
            self.db.add(app_user)

        await self.db.commit()
        await self.db.refresh(local_user)

        # Issue token
        claims: Dict[str, Any] = {
            "sub": local_user.id,
            "email": local_user.email,
            "name": local_user.name,
            "role": local_user.role,
            "username": local_user.username,
            "auth_type": "local",
        }
        try:
            expires_minutes = int(getattr(settings, "jwt_expire_minutes", 60))
        except (TypeError, ValueError):
            expires_minutes = 60
        token = create_access_token(claims, expires_minutes=expires_minutes)

        return local_user, token

    async def login_local_user(self, username: str, password: str) -> Tuple[LocalUser, str]:
        """Authenticate a local user with username/email and password."""
        # Try to find by username first, then by email
        result = await self.db.execute(select(LocalUser).where(LocalUser.username == username))
        local_user = result.scalar_one_or_none()

        if not local_user:
            result = await self.db.execute(select(LocalUser).where(LocalUser.email == username))
            local_user = result.scalar_one_or_none()

        if not local_user:
            raise ValueError("Invalid username or password")

        if not _verify_password(password, local_user.hashed_password):
            raise ValueError("Invalid username or password")

        # Update last login
        local_user.last_login = datetime.now(timezone.utc)

        # Also update the app User record
        result = await self.db.execute(select(User).where(User.id == local_user.id))
        app_user = result.scalar_one_or_none()
        if app_user:
            app_user.last_login = datetime.now(timezone.utc)

        await self.db.commit()
        await self.db.refresh(local_user)

        # Issue token
        claims: Dict[str, Any] = {
            "sub": local_user.id,
            "email": local_user.email,
            "name": local_user.name,
            "role": local_user.role,
            "username": local_user.username,
            "auth_type": "local",
        }
        try:
            expires_minutes = int(getattr(settings, "jwt_expire_minutes", 60))
        except (TypeError, ValueError):
            expires_minutes = 60
        token = create_access_token(claims, expires_minutes=expires_minutes)

        return local_user, token

    async def store_oidc_state(self, state: str, nonce: str, code_verifier: str):
        """Store OIDC state in database."""
        # Clean up expired states first
        await self.db.execute(delete(OIDCState).where(OIDCState.expires_at < datetime.now(timezone.utc)))

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)  # 10 minute expiry

        oidc_state = OIDCState(state=state, nonce=nonce, code_verifier=code_verifier, expires_at=expires_at)

        self.db.add(oidc_state)
        await self.db.commit()

    async def get_and_delete_oidc_state(self, state: str) -> Optional[dict]:
        """Get and delete OIDC state from database."""
        # Clean up expired states first
        await self.db.execute(delete(OIDCState).where(OIDCState.expires_at < datetime.now(timezone.utc)))

        # Find and validate state
        result = await self.db.execute(select(OIDCState).where(OIDCState.state == state))
        oidc_state = result.scalar_one_or_none()

        if not oidc_state:
            return None

        # Extract data before deleting
        state_data = {"nonce": oidc_state.nonce, "code_verifier": oidc_state.code_verifier}

        # Delete the used state (one-time use)
        await self.db.delete(oidc_state)
        await self.db.commit()

        return state_data


async def initialize_admin_user():
    """Initialize admin user if not exists"""
    if "MGX_IGNORE_INIT_ADMIN" in os.environ:
        logger.info("Ignore initialize admin")
        return

    from services.database import initialize_database

    # Ensure database is initialized first
    await initialize_database()

    admin_user_id = getattr(settings, "admin_user_id", "")
    admin_user_email = getattr(settings, "admin_user_email", "")

    if not admin_user_id or not admin_user_email:
        logger.warning("Admin user ID or email not configured, skipping admin initialization")
        return

    async with db_manager.async_session_maker() as db:
        # Check if admin user already exists
        result = await db.execute(select(User).where(User.id == admin_user_id))
        user = result.scalar_one_or_none()

        if user:
            # Update existing user to admin if not already
            if user.role != "admin":
                user.role = "admin"
                user.email = admin_user_email  # Update email too
                await db.commit()
                logger.debug(f"Updated user {admin_user_id} to admin role")
            else:
                logger.debug(f"Admin user {admin_user_id} already exists")
        else:
            # Create new admin user
            admin_user = User(id=admin_user_id, email=admin_user_email, role="admin")
            db.add(admin_user)
            await db.commit()
            logger.debug(f"Created admin user: {admin_user_id} with email: {admin_user_email}")
