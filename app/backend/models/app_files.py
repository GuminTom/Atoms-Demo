from core.database import Base
from sqlalchemy import Column, Integer, String


class App_files(Base):
    __tablename__ = "app_files"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    app_id = Column(Integer, nullable=False)
    path = Column(String, nullable=False)
    content = Column(String, nullable=True)
    language = Column(String, nullable=True)