import json
import logging
import time
from typing import Optional

from core.mask_crypto import decrypt_text, encrypt_text
from models.auth import User
from models.user_preferences import UserApiKey, UserPreferences
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class UserService:
    @staticmethod
    async def get_user_profile(db: AsyncSession, user_id: str) -> Optional[User]:
        """Get user profile by user ID."""
        start_time = time.time()
        logger.debug(f"[DB_OP] Starting get_user_profile - user_id: {user_id}")
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        logger.debug(
            f"[DB_OP] Get user profile completed in {time.time() - start_time:.4f}s - found: {user is not None}"
        )
        return user

    @staticmethod
    async def update_user_profile(db: AsyncSession, user_id: str, name: Optional[str] = None) -> Optional[User]:
        """Update user profile."""
        start_time = time.time()
        logger.debug(f"[DB_OP] Starting update_user_profile - user_id: {user_id}")
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        logger.debug(f"[DB_OP] User lookup completed in {time.time() - start_time:.4f}s - found: {user is not None}")

        if user and name is not None:
            start_time_update = time.time()
            logger.debug("[DB_OP] Starting user profile update")
            user.name = name
            await db.commit()
            await db.refresh(user)
            logger.debug(f"[DB_OP] User profile update completed in {time.time() - start_time_update:.4f}s")

        return user

    # ── Preferences ──────────────────────────────────────────────

    @staticmethod
    async def get_preferences(db: AsyncSession, user_id: str) -> dict:
        """Get user preferences including default model, workspace prefs, and GitHub status."""
        result = await db.execute(select(UserPreferences).where(UserPreferences.user_id == user_id))
        prefs = result.scalar_one_or_none()

        # Get API keys
        keys_result = await db.execute(select(UserApiKey).where(UserApiKey.user_id == user_id))
        api_keys = keys_result.scalars().all()

        api_key_entries = [
            {
                "provider": k.provider,
                "key_preview": k.key_preview or "",
                "is_set": True,
            }
            for k in api_keys
        ]

        # Merge with default providers
        default_providers = ["openai", "anthropic", "deepseek", "google"]
        existing_providers = {k.provider for k in api_keys}
        for p in default_providers:
            if p not in existing_providers:
                api_key_entries.append({"provider": p, "key_preview": "", "is_set": False})

        if not prefs:
            return {
                "default_model": "deepseek-v3.2",
                "preferences": {
                    "theme": "dark",
                    "font_size": 14,
                    "tab_size": 2,
                    "word_wrap": True,
                    "auto_save": True,
                    "auto_save_delay": 2000,
                },
                "github_bound": False,
                "github_username": "",
                "api_keys": api_key_entries,
            }

        workspace_prefs = {}
        if prefs.preferences:
            try:
                workspace_prefs = json.loads(prefs.preferences)
            except (json.JSONDecodeError, TypeError):
                workspace_prefs = {}

        return {
            "default_model": prefs.default_model or "deepseek-v3.2",
            "preferences": {
                "theme": "dark",
                "font_size": 14,
                "tab_size": 2,
                "word_wrap": True,
                "auto_save": True,
                "auto_save_delay": 2000,
                **workspace_prefs,
            },
            "github_bound": prefs.github_bound or False,
            "github_username": prefs.github_username or "",
            "api_keys": api_key_entries,
        }

    @staticmethod
    async def update_preferences(db: AsyncSession, user_id: str, data: dict) -> dict:
        """Update user preferences (default_model, workspace preferences, github)."""
        result = await db.execute(select(UserPreferences).where(UserPreferences.user_id == user_id))
        prefs = result.scalar_one_or_none()

        if not prefs:
            prefs = UserPreferences(user_id=user_id)
            db.add(prefs)

        if "default_model" in data:
            prefs.default_model = data["default_model"]

        if "preferences" in data:
            prefs.preferences = json.dumps(data["preferences"])

        if "github_bound" in data:
            prefs.github_bound = data["github_bound"]

        if "github_username" in data:
            prefs.github_username = data["github_username"]

        await db.commit()
        await db.refresh(prefs)

        return await UserService.get_preferences(db, user_id)

    # ── API Keys ─────────────────────────────────────────────────

    @staticmethod
    async def add_api_key(db: AsyncSession, user_id: str, provider: str, key: str) -> dict:
        """Add or update an API key for a provider."""
        encrypted = encrypt_text(key)
        key_preview = f"****{key[-4:]}" if len(key) >= 4 else "****"

        result = await db.execute(
            select(UserApiKey).where(UserApiKey.user_id == user_id, UserApiKey.provider == provider)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.encrypted_key = encrypted
            existing.key_preview = key_preview
        else:
            new_key = UserApiKey(
                user_id=user_id,
                provider=provider,
                encrypted_key=encrypted,
                key_preview=key_preview,
            )
            db.add(new_key)

        await db.commit()
        return {"provider": provider, "key_preview": key_preview, "is_set": True}

    @staticmethod
    async def delete_api_key(db: AsyncSession, user_id: str, provider: str) -> bool:
        """Delete an API key for a provider."""
        result = await db.execute(
            select(UserApiKey).where(UserApiKey.user_id == user_id, UserApiKey.provider == provider)
        )
        existing = result.scalar_one_or_none()

        if existing:
            await db.delete(existing)
            await db.commit()
            return True
        return False

    @staticmethod
    async def get_api_key_value(db: AsyncSession, user_id: str, provider: str) -> Optional[str]:
        """Get decrypted API key value (for internal use only)."""
        result = await db.execute(
            select(UserApiKey).where(UserApiKey.user_id == user_id, UserApiKey.provider == provider)
        )
        existing = result.scalar_one_or_none()

        if existing:
            try:
                return decrypt_text(existing.encrypted_key)
            except Exception:
                logger.error(f"Failed to decrypt API key for provider {provider}")
                return None
        return None

    # ── GitHub ───────────────────────────────────────────────────

    @staticmethod
    async def bind_github(db: AsyncSession, user_id: str, username: str) -> dict:
        """Bind GitHub account to user."""
        return await UserService.update_preferences(
            db, user_id, {"github_bound": True, "github_username": username}
        )

    @staticmethod
    async def unbind_github(db: AsyncSession, user_id: str) -> dict:
        """Unbind GitHub account from user."""
        return await UserService.update_preferences(
            db, user_id, {"github_bound": False, "github_username": ""}
        )