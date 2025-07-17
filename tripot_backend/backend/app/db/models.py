from sqlalchemy import Column, Integer, String, Text, DateTime, Date, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base # database.py에서 만든 Base 클래스를 가져옵니다.

# 'users' 테이블 모델
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_id_str = Column(String(255), unique=True, index=True, nullable=False)
    # 다른 사용자 정보 필드 추가 가능 (예: name, created_at)

    conversations = relationship("Conversation", back_populates="user")
    summaries = relationship("Summary", back_populates="user")


# 'conversations' 테이블 모델
class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id")) # users 테이블의 id와 연결
    speaker = Column(String(50), nullable=False) # 'user' 또는 'ai'
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="conversations")


# 'summaries' 테이블 모델
class Summary(Base):
    __tablename__ = "summaries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id")) # users 테이블의 id와 연결
    report_date = Column(Date, nullable=False)
    summary_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="summaries")