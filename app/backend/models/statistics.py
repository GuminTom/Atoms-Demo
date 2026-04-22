from core.database import Base
from sqlalchemy import Column, Integer, String


class Statistics(Base):
    __tablename__ = "statistics"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    app_id = Column(Integer, nullable=True)
    metric_type = Column(String, nullable=False)
    metric_value = Column(Integer, nullable=False)