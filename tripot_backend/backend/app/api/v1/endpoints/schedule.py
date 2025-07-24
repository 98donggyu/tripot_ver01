from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.db.database import get_db
from app.services.schedule_service import ScheduleService
from app.db.models import User, ConversationSchedule

router = APIRouter()

# 정시 대화용 Pydantic 스키마
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

class FamilyScheduleRequest(BaseModel):
    senior_user_id: str      # 어르신 ID
    family_user_id: str      # 가족 구성원 ID
    call_times: List[str]    # ["09:00", "14:00", "19:00"]
    set_by: str = "family"   # 설정한 사람 구분

class ScheduleUpdateCheckResponse(BaseModel):
    has_update: bool
    schedules: Optional[List[dict]] = None
    last_updated_by: Optional[str] = None
    update_time: Optional[datetime] = None

# 정시 대화 스케줄 엔드포인트들

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

# 가족용 엔드포인트들

@router.get("/user/{user_id_str}")
def get_user_info(user_id_str: str, db: Session = Depends(get_db)):
    """사용자 정보 조회 (스케줄 업데이트 시간 포함)"""
    try:
        print(f"👤 사용자 정보 조회 요청: {user_id_str}")
        
        user = db.query(User).filter(User.user_id_str == user_id_str).first()
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        return {
            "user_id_str": user.user_id_str,
            "name": getattr(user, 'name', None),
            "schedule_updated_at": getattr(user, 'schedule_updated_at', None),
            "schedule_updated_by": getattr(user, 'schedule_updated_by', None),
            "last_schedule_check": getattr(user, 'last_schedule_check', None)
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ 사용자 정보 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"사용자 정보 조회 실패: {str(e)}")

@router.post("/family/set")
def set_family_schedule(request: FamilyScheduleRequest, db: Session = Depends(get_db)):
    """가족이 어르신의 정시 대화 시간 설정"""
    try:
        print(f"👨‍👩‍👧‍👦 가족 스케줄 설정 요청: {request.family_user_id} -> {request.senior_user_id} - {request.call_times}")
        
        # 어르신 사용자 존재 확인
        senior_user = db.query(User).filter(User.user_id_str == request.senior_user_id).first()
        if not senior_user:
            raise HTTPException(status_code=404, detail="어르신 사용자를 찾을 수 없습니다")
        
        # 가족 사용자 존재 확인
        family_user = db.query(User).filter(User.user_id_str == request.family_user_id).first()
        if not family_user:
            raise HTTPException(status_code=404, detail="가족 사용자를 찾을 수 없습니다")
        
        # 시간 형식 검증
        for time_str in request.call_times:
            try:
                hour, minute = map(int, time_str.split(':'))
                if not (0 <= hour <= 23 and 0 <= minute <= 59):
                    raise ValueError("시간 범위 오류")
            except ValueError:
                raise HTTPException(status_code=400, detail=f"잘못된 시간 형식: {time_str} (HH:MM 형식으로 입력하세요)")
        
        # 기존 스케줄 삭제
        db.query(ConversationSchedule).filter(ConversationSchedule.user_id == senior_user.id).delete()
        
        # 새로운 스케줄 생성
        schedules = []
        for time_str in request.call_times:
            schedule = ConversationSchedule(
                user_id=senior_user.id,
                call_time=datetime.strptime(time_str, "%H:%M").time(),
                is_enabled=True,
                set_by=request.set_by,
                family_user_id=family_user.id  # 설정한 가족 구성원 ID 저장
            )
            db.add(schedule)
            schedules.append(schedule)
        
        db.commit()
        
        # 어르신 앱에서 확인할 수 있도록 업데이트 플래그 설정
        senior_user.schedule_updated_at = datetime.utcnow()
        senior_user.schedule_updated_by = request.family_user_id
        db.commit()
        
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
                "created_at": schedule.created_at,
                "set_by": schedule.set_by
            })
        
        return {
            "status": "success",
            "message": f"가족이 어르신의 정시 대화 시간을 설정했습니다",
            "schedules": response_schedules,
            "senior_user_id": request.senior_user_id,
            "set_by_family": request.family_user_id
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ 가족 스케줄 설정 실패: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"가족 스케줄 설정 실패: {str(e)}")

@router.get("/family/check/{senior_user_id}")
def check_schedule_update(senior_user_id: str, db: Session = Depends(get_db)):
    """어르신 앱에서 가족의 스케줄 변경사항 확인"""
    try:
        print(f"🔍 스케줄 업데이트 확인 요청: {senior_user_id}")
        
        # 어르신 사용자 확인
        senior_user = db.query(User).filter(User.user_id_str == senior_user_id).first()
        if not senior_user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        # 마지막 확인 시간 이후 업데이트가 있는지 확인
        last_check = getattr(senior_user, 'last_schedule_check', None)
        schedule_updated_at = getattr(senior_user, 'schedule_updated_at', None)
        
        has_update = False
        schedules_data = None
        last_updated_by = None
        update_time = None
        
        if schedule_updated_at and (not last_check or schedule_updated_at > last_check):
            has_update = True
            
            # 현재 스케줄 조회
            schedules = ScheduleService.get_user_schedules(db, senior_user_id)
            schedules_data = []
            for schedule in schedules:
                schedules_data.append({
                    "id": schedule.id,
                    "call_time": schedule.call_time.strftime("%H:%M"),
                    "is_enabled": schedule.is_enabled,
                    "created_at": schedule.created_at,
                    "set_by": getattr(schedule, 'set_by', 'user')
                })
            
            last_updated_by = getattr(senior_user, 'schedule_updated_by', 'unknown')
            update_time = schedule_updated_at
            
            # 확인 시간 업데이트
            senior_user.last_schedule_check = datetime.utcnow()
            db.commit()
        
        return {
            "has_update": has_update,
            "schedules": schedules_data,
            "last_updated_by": last_updated_by,
            "update_time": update_time,
            "senior_user_id": senior_user_id
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ 스케줄 업데이트 확인 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"스케줄 업데이트 확인 실패: {str(e)}")

@router.get("/family/view/{senior_user_id}")
def view_senior_schedule(senior_user_id: str, family_user_id: str, db: Session = Depends(get_db)):
    """가족이 어르신의 현재 스케줄 조회"""
    try:
        print(f"👨‍👩‍👧‍👦 가족의 어르신 스케줄 조회: {family_user_id} -> {senior_user_id}")
        
        # 어르신 사용자 확인
        senior_user = db.query(User).filter(User.user_id_str == senior_user_id).first()
        if not senior_user:
            raise HTTPException(status_code=404, detail="어르신 사용자를 찾을 수 없습니다")
        
        # 가족 사용자 확인
        family_user = db.query(User).filter(User.user_id_str == family_user_id).first()
        if not family_user:
            raise HTTPException(status_code=404, detail="가족 사용자를 찾을 수 없습니다")
        
        # 현재 스케줄 조회
        schedules = ScheduleService.get_user_schedules(db, senior_user_id)
        
        schedule_list = []
        for schedule in schedules:
            schedule_list.append({
                "id": schedule.id,
                "call_time": schedule.call_time.strftime("%H:%M"),
                "is_enabled": schedule.is_enabled,
                "created_at": schedule.created_at,
                "set_by": getattr(schedule, 'set_by', 'user')
            })
        
        return {
            "senior_user_id": senior_user_id,
            "senior_name": getattr(senior_user, 'name', '어르신'),
            "family_user_id": family_user_id,
            "schedules": schedule_list,
            "total_count": len(schedule_list),
            "last_updated": getattr(senior_user, 'schedule_updated_at', None),
            "last_updated_by": getattr(senior_user, 'schedule_updated_by', None)
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ 가족 스케줄 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"가족 스케줄 조회 실패: {str(e)}")

# 스케줄러 관련 엔드포인트들
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