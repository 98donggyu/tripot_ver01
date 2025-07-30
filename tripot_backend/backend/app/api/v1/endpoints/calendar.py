# app/api/v1/endpoints/calendar.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json

from app.db.database import get_db
from app.db import crud

router = APIRouter()

# --- Pydantic Schemas ---
class CalendarEvent(BaseModel):
    id: str
    text: str
    created_at: datetime

class CalendarEventRequest(BaseModel):
    senior_user_id: str
    family_user_id: str
    date: str  # "YYYY-MM-DD"
    events: List[CalendarEvent]

# --- Helper function for JSON serialization ---
def json_default_serializer(obj):
    """datetime 객체를 ISO 형식 문자열로 변환하는 JSON 직렬화 헬퍼"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f'Object of type {obj.__class__.__name__} is not JSON serializable')

# --- API Endpoints ---
@router.post("/events/update")
def update_calendar_events(request: CalendarEventRequest, db: Session = Depends(get_db)):
    """가족이 어르신의 캘린더 일정을 수정합니다."""
    senior_user = crud.get_user_by_user_id_str(db, request.senior_user_id)
    if not senior_user:
        raise HTTPException(status_code=404, detail="어르신 사용자를 찾을 수 없습니다")
    
    # 기존 캘린더 데이터를 불러옵니다.
    try:
        calendar_data = json.loads(senior_user.calendar_data) if senior_user.calendar_data else {}
    except (json.JSONDecodeError, TypeError):
        calendar_data = {}
    
    # 요청받은 날짜의 데이터를 업데이트합니다.
    events_data = [event.model_dump() for event in request.events]

    if events_data:
        calendar_data[request.date] = {
            "events": events_data,
            "marked": True,
            "dotColor": "#50cebb"
        }
    elif request.date in calendar_data:
        del calendar_data[request.date]
        
    # 🔽 datetime 객체를 처리할 수 있도록 default 핸들러 추가 (FIX) 🔽
    calendar_json = json.dumps(calendar_data, ensure_ascii=False, default=json_default_serializer) # ◀️ FIX
    
    crud.update_calendar_data(db, 
        senior_user_id_str=request.senior_user_id,
        family_user_id_str=request.family_user_id,
        calendar_json=calendar_json
    )
    
    return {"status": "success", "message": "캘린더 일정이 업데이트되었습니다."}


@router.get("/events/{senior_user_id}")
def get_calendar_events(senior_user_id: str, db: Session = Depends(get_db)):
    """어르신의 모든 캘린더 일정을 조회합니다."""
    user = crud.get_user_by_user_id_str(db, senior_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
    
    try:
        calendar_data = json.loads(user.calendar_data) if user.calendar_data else {}
    except (json.JSONDecodeError, TypeError):
        calendar_data = {}

    return {
        "senior_user_id": senior_user_id,
        "calendar_data": calendar_data,
        "last_updated": user.calendar_updated_at,
        "last_updated_by": user.calendar_updated_by
    }

@router.get("/check-updates/{senior_user_id}")
def check_calendar_updates(senior_user_id: str, db: Session = Depends(get_db)):
    """어르신 앱에서 캘린더 업데이트를 확인합니다."""
    user = crud.get_user_by_user_id_str(db, senior_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    response_data = {"has_update": False}
    
    if user.calendar_updated_at and (not user.last_calendar_check or user.calendar_updated_at > user.last_calendar_check):
        try:
            calendar_data = json.loads(user.calendar_data) if user.calendar_data else {}
        except (json.JSONDecodeError, TypeError):
            calendar_data = {}

        response_data.update({
            "has_update": True,
            "calendar_data": calendar_data,
            "last_updated_by": user.calendar_updated_by,
            "update_time": user.calendar_updated_at.isoformat() # ◀️ FIX
        })
        crud.update_user_last_calendar_check(db, senior_user_id)

    return response_data