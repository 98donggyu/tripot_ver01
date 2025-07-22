from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime

from app.db.database import get_db
from app.services.schedule_service import ScheduleService
from app.db.models import User, ConversationSchedule

router = APIRouter()

# Pydantic 스키마
class ScheduleRequest(BaseModel):
    user_id_str: str
    call_times: List[str]  # ["09:00", "14:00", "19:00"]

class ScheduleResponse(BaseModel):
    id: int
    call_time: str
    is_enabled: bool
    created_at: datetime

class ScheduleToggleRequest(BaseModel):
    is_enabled: bool

@router.post("/set")
def set_user_schedule(request: ScheduleRequest, db: Session = Depends(get_db)):
    """사용자의 정시 대화 시간 설정"""
    try:
        print(f"⏰ 스케줄 설정 요청: {request.user_id_str} - {request.call_times}")
        
        # 시간 형식 검증
        for time_str in request.call_times:
            try:
                hour, minute = map(int, time_str.split(':'))
                if not (0 <= hour <= 23 and 0 <= minute <= 59):
                    raise ValueError("시간 범위 오류")
            except ValueError:
                raise HTTPException(status_code=400, detail=f"잘못된 시간 형식: {time_str} (HH:MM 형식으로 입력하세요)")
        
        schedules = ScheduleService.set_user_schedule(db, request.user_id_str, request.call_times)
        
        # 스케줄러 재설정
        from app.services.schedule_service import scheduler_service
        scheduler_service.setup_daily_schedules()
        
        # 응답 데이터 구성
        response_schedules = []
        for schedule in schedules:
            response_schedules.append({
                "id": schedule.id,
                "call_time": schedule.call_time.strftime("%H:%M"),
                "is_enabled": schedule.is_enabled,
                "created_at": schedule.created_at
            })
        
        return {
            "status": "success",
            "message": "정시 대화 시간이 설정되었습니다",
            "schedules": response_schedules
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ 스케줄 설정 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"스케줄 설정 실패: {str(e)}")

@router.get("/current-time")
def get_current_time():
    """현재 서버 시간과 한국 시간 확인"""
    import pytz
    from datetime import datetime
    
    utc_time = datetime.utcnow()
    kst = pytz.timezone('Asia/Seoul')
    korea_time = datetime.now(kst)
    
    return {
        "utc_time": utc_time.strftime('%Y-%m-%d %H:%M:%S'),
        "korea_time": korea_time.strftime('%Y-%m-%d %H:%M:%S'),
        "timezone": "Asia/Seoul"
    }

@router.get("/{user_id_str}")
def get_user_schedule(user_id_str: str, db: Session = Depends(get_db)):
    """사용자의 현재 스케줄 조회"""
    try:
        print(f"📋 스케줄 조회 요청: {user_id_str}")
        
        schedules = ScheduleService.get_user_schedules(db, user_id_str)
        
        schedule_list = []
        for schedule in schedules:
            schedule_list.append({
                "id": schedule.id,
                "call_time": schedule.call_time.strftime("%H:%M"),
                "is_enabled": schedule.is_enabled,
                "created_at": schedule.created_at
            })
        
        return {
            "user_id": user_id_str,
            "schedules": schedule_list,
            "total_count": len(schedule_list)
        }
        
    except Exception as e:
        print(f"❌ 스케줄 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"스케줄 조회 실패: {str(e)}")

@router.put("/{schedule_id}/toggle")
def toggle_schedule(schedule_id: int, request: ScheduleToggleRequest, db: Session = Depends(get_db)):
    """특정 스케줄 활성화/비활성화"""
    try:
        print(f"🔄 스케줄 토글 요청: {schedule_id} -> {request.is_enabled}")
        
        success = ScheduleService.toggle_schedule(db, schedule_id, request.is_enabled)
        
        if success:
            # 스케줄러 재설정
            from app.services.schedule_service import scheduler_service
            scheduler_service.setup_daily_schedules()
            
            return {
                "status": "success",
                "message": f"스케줄이 {'활성화' if request.is_enabled else '비활성화'}되었습니다"
            }
        else:
            raise HTTPException(status_code=500, detail="스케줄 변경에 실패했습니다")
            
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ 스케줄 토글 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"스케줄 토글 실패: {str(e)}")

@router.delete("/{user_id_str}")
def remove_user_schedule(user_id_str: str, db: Session = Depends(get_db)):
    """사용자의 모든 스케줄 제거"""
    try:
        print(f"🗑️ 스케줄 제거 요청: {user_id_str}")
        
        user = db.query(User).filter(User.user_id_str == user_id_str).first()
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        deleted_count = db.query(ConversationSchedule).filter(ConversationSchedule.user_id == user.id).delete()
        db.commit()
        
        # 스케줄러 재설정
        from app.services.schedule_service import scheduler_service
        scheduler_service.setup_daily_schedules()
        
        return {
            "status": "success",
            "message": f"{deleted_count}개의 스케줄이 제거되었습니다"
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ 스케줄 제거 실패: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"스케줄 제거 실패: {str(e)}")

@router.post("/start-scheduler")
def start_scheduler():
    """스케줄러 시작"""
    try:
        from app.services.schedule_service import scheduler_service
        import asyncio
        
        if not scheduler_service.is_running:
            asyncio.create_task(scheduler_service.start_scheduler())
            return {"status": "success", "message": "스케줄러가 시작되었습니다"}
        else:
            return {"status": "info", "message": "스케줄러가 이미 실행 중입니다"}
            
    except Exception as e:
        print(f"❌ 스케줄러 시작 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"스케줄러 시작 실패: {str(e)}")

@router.post("/stop-scheduler")
def stop_scheduler():
    """스케줄러 중지"""
    try:
        from app.services.schedule_service import scheduler_service
        scheduler_service.stop_scheduler()
        return {"status": "success", "message": "스케줄러가 중지되었습니다"}
        
    except Exception as e:
        print(f"❌ 스케줄러 중지 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"스케줄러 중지 실패: {str(e)}")