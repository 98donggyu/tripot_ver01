# app/schemas.py

from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date, time

# --- User Schemas ---
class UserBase(BaseModel):
    user_id_str: str
    name: Optional[str] = None

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int

    class Config:
        from_attributes = True

# --- Report Schemas ---
class SeniorReportStatus(BaseModel):
    mood: str
    condition: str
    last_activity: str
    needs: str

class SeniorReportStats(BaseModel):
    contact: int
    visit: int
    Youtubeed: int

class SeniorReportRanking(BaseModel):
    name: str
    score: int

class SeniorReportSummary(BaseModel):
    name: str
    report_date: str
    status: SeniorReportStatus
    stats: SeniorReportStats
    ranking: List[SeniorReportRanking]

# --- Photo & Comment Schemas ---
class PhotoCommentBase(BaseModel):
    comment_text: str

class CommentCreate(PhotoCommentBase):
    user_id_str: str
    author_name: str

class Comment(PhotoCommentBase):
    id: int
    author_name: str
    created_at: datetime

    class Config:
        from_attributes = True

class FamilyPhoto(BaseModel):
    id: int
    uploaded_by: str
    created_at: datetime
    file_url: str
    comments: List[Comment] = []

    class Config:
        from_attributes = True
