from core.database import Base
from sqlalchemy import Column, Integer, String


class Agent_sessions(Base):
    __tablename__ = "agent_sessions"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    app_id = Column(Integer, nullable=False)
    mode = Column(String, nullable=False)
    messages_json = Column(String, nullable=True)
    status = Column(String, nullable=True)