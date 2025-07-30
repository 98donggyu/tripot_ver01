# app/api/v1/endpoints/schedule.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, time

from app.db.database import get_db
from app.db import crud
from app.services.schedule_service import scheduler_service

router = APIRouter()

# --- Pydantic Schemas ---
class ScheduleRequest(BaseModel):
    user_id_str: str
    call_times: List[str]

class FamilyScheduleRequest(BaseModel):
    senior_user_id: str
    family_user_id: str
    call_times: List[str]

# --- Helper function ---
def _validate_and_parse_times(call_times: List[str]) -> List[time]:
    parsed_times = []
    for time_str in call_times:
        try:
            parsed_times.append(datetime.strptime(time_str, "%H:%M").time())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"잘못된 시간 형식: {time_str}")
    return parsed_times

def _format_schedules_for_response(schedules: list) -> List[dict]:
    return [
        {
            "id": s.id,
            "call_time": s.call_time.strftime("%H:%M"),
            "is_enabled": s.is_enabled,
            "created_at": s.created_at.isoformat(),
            "set_by": s.set_by,
        }
        for s in schedules
    ]

# --- API Endpoints ---

@router.post("/set")
def set_user_schedule(request: ScheduleRequest, db: Session = Depends(get_db)):
    """어르신 본인이 스케줄을 설정합니다."""
    parsed_times = _validate_and_parse_times(request.call_times)
    crud.set_schedules(db, user_id_str=request.user_id_str, call_times=parsed_times)
    scheduler_service.setup_daily_schedules()
    
    updated_schedules = crud.get_schedules_by_user_id_str(db, request.user_id_str)
    return {
        "status": "success",
        "message": "정시 대화 시간이 설정되었습니다.",
        "schedules": _format_schedules_for_response(updated_schedules), # FIX: 응답에 스케줄 포함
    }

@router.post("/family/set")
def set_family_schedule(request: FamilyScheduleRequest, db: Session = Depends(get_db)):
    """가족이 어르신의 스케줄을 설정합니다."""
    parsed_times = _validate_and_parse_times(request.call_times)
    crud.set_schedules(
        db,
        user_id_str=request.senior_user_id,
        call_times=parsed_times,
        family_user_id_str=request.family_user_id,
    )
    scheduler_service.setup_daily_schedules()

    updated_schedules = crud.get_schedules_by_user_id_str(db, request.senior_user_id)
    return {
        "status": "success",
        "message": "가족이 어르신의 스케줄을 설정했습니다.",
        "schedules": _format_schedules_for_response(updated_schedules), # FIX: 응답에 스케줄 포함
    }

@router.delete("/remove-all/{user_id_str}")
def remove_all_user_schedules(user_id_str: str, db: Session = Depends(get_db)):
    """사용자의 모든 스케줄을 제거합니다."""
    deleted_count = crud.delete_schedules_by_user_id_str(db, user_id_str)
    scheduler_service.setup_daily_schedules()
    return {"status": "success", "message": f"{deleted_count}개의 스케줄이 제거되었습니다."}


@router.get("/{user_id_str}")
def get_user_schedule(user_id_str: str, db: Session = Depends(get_db)):
    schedules = crud.get_schedules_by_user_id_str(db, user_id_str)
    return {
        "user_id": user_id_str,
        "schedules": _format_schedules_for_response(schedules),
    }

@router.get("/family/check/{senior_user_id}")
def check_schedule_update(senior_user_id: str, db: Session = Depends(get_db)):
    user = crud.get_user_by_user_id_str(db, senior_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    has_update = False
    response_data = {"has_update": False}

    if user.schedule_updated_at and (
        not user.last_schedule_check or user.schedule_updated_at > user.last_schedule_check
    ):
        has_update = True
        schedules = crud.get_schedules_by_user_id_str(db, senior_user_id)
        
        response_data.update({
            "schedules": _format_schedules_for_response(schedules),
            "last_updated_by": user.schedule_updated_by,
            "update_time": user.schedule_updated_at.isoformat(),
        })
        crud.update_user_last_schedule_check(db, senior_user_id)

    response_data["has_update"] = has_update
    return response_data