from core.database import Base
from sqlalchemy import Column, Integer, String


class Deployments(Base):
    __tablename__ = "deployments"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    app_id = Column(Integer, nullable=False)
    status = Column(String, nullable=True)
    url = Column(String, nullable=True)
    version = Column(String, nullable=True)
    environment = Column(String, nullable=True)
    logs = Column(String, nullable=True)