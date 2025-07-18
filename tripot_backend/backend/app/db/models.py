from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
from datetime import datetime  # 🔧 추가

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    user_id_str = Column(String(255), unique=True, index=True, nullable=False)
    photos = relationship("FamilyPhoto", back_populates="user")
    # comments = relationship("PhotoComment", back_populates="user")  # 🔧 임시 주석

class FamilyPhoto(Base):
    __tablename__ = "family_photos"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255))
    file_path = Column(String(512), nullable=False)
    file_size = Column(Integer)
    uploaded_by = Column(String(50))
    # 🔧 Python default 추가로 확실하게 처리
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    user = relationship("User", back_populates="photos")
    # comments = relationship("PhotoComment", back_populates="photo", cascade="all, delete-orphan")  # 🔧 임시 주석

# 🔧 PhotoComment 클래스 임시 주석 처리
# class PhotoComment(Base):
#     __tablename__ = "photo_comments"
#     id = Column(Integer, primary_key=True, index=True)
#     photo_id = Column(Integer, ForeignKey("family_photos.id"), nullable=False)
#     user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
#     author_name = Column(String(100), nullable=False)
#     comment_text = Column(Text, nullable=False)
#     created_at = Column(DateTime(timezone=True), server_default=func.now(), default=datetime.utcnow)
    
#     photo = relationship("FamilyPhoto", back_populates="comments")
#     user = relationship("User", back_populates="comments")