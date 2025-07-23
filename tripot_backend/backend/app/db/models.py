from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    user_id_str = Column(String(255), unique=True, index=True, nullable=False)
    
    # 🔥 추가: 가족 스케줄 관리용 컬럼들
    schedule_updated_at = Column(DateTime(timezone=True), nullable=True)  # 스케줄이 마지막으로 업데이트된 시간
    schedule_updated_by = Column(String(255), nullable=True)              # 스케줄을 마지막으로 업데이트한 사용자 ID
    last_schedule_check = Column(DateTime(timezone=True), nullable=True)   # 어르신 앱에서 마지막으로 확인한 시간
    name = Column(String(100), nullable=True)                             # 사용자 이름 (가족 앱에서 표시용)
    
    # 관계 설정 (foreign_keys 명시)
    photos = relationship("FamilyPhoto", back_populates="user")
    comments = relationship("PhotoComment", back_populates="user")
    
    # 🔧 수정: foreign_keys 명시해서 충돌 해결
    schedules = relationship(
        "ConversationSchedule", 
        foreign_keys="ConversationSchedule.user_id",
        back_populates="user"
    )
    
    # 🔧 수정: 가족이 설정한 스케줄들 (foreign_keys 명시)
    family_set_schedules = relationship(
        "ConversationSchedule", 
        foreign_keys="ConversationSchedule.family_user_id",
        back_populates="family_user"
    )

class FamilyPhoto(Base):
    __tablename__ = "family_photos"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255))
    file_path = Column(String(512), nullable=False)
    file_size = Column(Integer)
    uploaded_by = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    
    user = relationship("User", back_populates="photos")
    comments = relationship("PhotoComment", back_populates="photo", cascade="all, delete-orphan")

class PhotoComment(Base):
    __tablename__ = "photo_comments"
    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("family_photos.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author_name = Column(String(100), nullable=False) # 클라이언트에서 받은 작성자 이름
    comment_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    
    photo = relationship("FamilyPhoto", back_populates="comments")
    user = relationship("User", back_populates="comments")

class ConversationSchedule(Base):
    __tablename__ = "conversation_schedules"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 어르신 ID
    call_time = Column(Time, nullable=False)  # 예: "09:00:00"
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=datetime.utcnow)
    
    # 🔥 추가: 가족 관리용 컬럼들
    set_by = Column(String(50), default='user')                          # 'user' 또는 'family'
    family_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 설정한 가족 구성원 ID
    
    # 🔧 수정: foreign_keys 명시해서 관계 설정
    user = relationship(
        "User", 
        foreign_keys=[user_id],
        back_populates="schedules"
    )  # 어르신과의 관계
    
    # 🔧 수정: 설정한 가족 구성원과의 관계 (foreign_keys 명시)
    family_user = relationship(
        "User", 
        foreign_keys=[family_user_id],
        back_populates="family_set_schedules"
    )