from core.database import Base
from sqlalchemy import Column, Integer, String


class Apps(Base):
    __tablename__ = "apps"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    type = Column(String, nullable=True)
    status = Column(String, nullable=True)
    agent_mode = Column(String, nullable=True)
    thumbnail = Column(String, nullable=True)