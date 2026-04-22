import logging

from core.database import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True, unique=True)
    default_model = Column(String(100), nullable=True)
    preferences = Column(Text, nullable=True)  # JSON string for workspace prefs
    github_bound = Column(Boolean, default=False, nullable=False)
    github_username = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserApiKey(Base):
    __tablename__ = "user_api_keys"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    provider = Column(String(100), nullable=False)
    encrypted_key = Column(Text, nullable=False)
    key_preview = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    logger = logging.getLogger(__name__)