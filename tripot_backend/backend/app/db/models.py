# app/db/models.py

from sqlalchemy import (Column, Integer, String, DateTime, ForeignKey, Text, 
                        Boolean, Time, Date, JSON)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    user_id_str = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=True)
    
    schedule_updated_at = Column(DateTime, nullable=True)
    schedule_updated_by = Column(String(255), nullable=True)
    last_schedule_check = Column(DateTime, nullable=True)
    calendar_data = Column(Text, nullable=True)
    calendar_updated_at = Column(DateTime, nullable=True)
    calendar_updated_by = Column(String(255), nullable=True)
    last_calendar_check = Column(DateTime, nullable=True)

    photos = relationship("FamilyPhoto", back_populates="user")
    comments = relationship("PhotoComment", back_populates="user")
    schedules = relationship("ConversationSchedule", foreign_keys="[ConversationSchedule.user_id]", back_populates="user")
    family_set_schedules = relationship("ConversationSchedule", foreign_keys="[ConversationSchedule.family_user_id]", back_populates="family_user")
    
    conversations = relationship("Conversation", back_populates="user_rel")
    summaries = relationship("Summary", back_populates="user_rel")
    quiz_results = relationship("QuizResult", back_populates="user_rel")

class FamilyPhoto(Base):
    __tablename__ = "family_photos"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255))
    file_path = Column(String(512), nullable=False)
    file_size = Column(Integer)
    uploaded_by = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())
    
    user = relationship("User", back_populates="photos")
    comments = relationship("PhotoComment", back_populates="photo", cascade="all, delete-orphan")

class PhotoComment(Base):
    __tablename__ = "photo_comments"
    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("family_photos.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author_name = Column(String(100), nullable=False)
    comment_text = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    
    photo = relationship("FamilyPhoto", back_populates="comments")
    user = relationship("User", back_populates="comments")

class ConversationSchedule(Base):
    __tablename__ = "conversation_schedules"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    call_time = Column(Time, nullable=False)
    is_enabled = Column(Boolean, default=True)
    set_by = Column(String(50), default='user')
    family_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", foreign_keys=[user_id], back_populates="schedules")
    family_user = relationship("User", foreign_keys=[family_user_id], back_populates="family_set_schedules")

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    speaker = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    
    user_rel = relationship("User", back_populates="conversations")

class Summary(Base):
    __tablename__ = "summaries"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_date = Column(Date, nullable=False)
    summary_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    
    user_rel = relationship("User", back_populates="summaries")

class Quiz(Base):
    __tablename__ = "quiz"
    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String(255), nullable=False)
    question_text = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class QuizResult(Base):
    __tablename__ = "quiz_results"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    quiz_id = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    user_answer = Column(Text)
    correct_answer = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    quiz_session_id = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
    
    user_rel = relationship("User", back_populates="quiz_results")

class DailyQA(Base):
    __tablename__ = "daily_qa"
    id = Column(Integer, primary_key=True, index=True)
    daily_date = Column(Date, nullable=False, unique=True)
    question_text = Column(Text, nullable=False)
    family_answer_content = Column(Text)
    elderly_answer_content = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())