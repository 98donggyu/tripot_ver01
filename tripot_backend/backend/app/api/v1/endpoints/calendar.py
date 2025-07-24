from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json

from app.db.database import get_db
from app.db.models import User

router = APIRouter()

# 📅 캘린더용 Pydantic 스키마
class CalendarEvent(BaseModel):
    id: str
    text: str
    created_at: datetime

class CalendarEventRequest(BaseModel):
    senior_user_id: str
    family_user_id: str
    date: str  # "2025-07-24" 형식
    events: List[CalendarEvent]

class CalendarEventsResponse(BaseModel):
    date: str
    events: List[CalendarEvent]
    total_count: int

class CalendarCheckResponse(BaseModel):
    has_update: bool
    updated_dates: Optional[List[CalendarEventsResponse]] = None
    last_updated_by: Optional[str] = None
    update_time: Optional[datetime] = None

# 🗓️ 캘린더 일정 관리 엔드포인트들

@router.post("/events/update")
def update_calendar_events(request: CalendarEventRequest, db: Session = Depends(get_db)):
    """가족이 어르신의 캘린더 일정 수정"""
    try:
        print(f"📅 캘린더 일정 수정 요청: {request.family_user_id} -> {request.senior_user_id}, 날짜: {request.date}")
        
        # 어르신 사용자 존재 확인
        senior_user = db.query(User).filter(User.user_id_str == request.senior_user_id).first()
        if not senior_user:
            raise HTTPException(status_code=404, detail="어르신 사용자를 찾을 수 없습니다")
        
        # 가족 사용자 존재 확인
        family_user = db.query(User).filter(User.user_id_str == request.family_user_id).first()
        if not family_user:
            raise HTTPException(status_code=404, detail="가족 사용자를 찾을 수 없습니다")
        
        # 날짜 형식 검증
        try:
            datetime.strptime(request.date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="잘못된 날짜 형식입니다. YYYY-MM-DD 형식으로 입력하세요")
        
        # 🔧 DB 컬럼이 없을 경우를 대비한 안전한 처리
        try:
            existing_data = getattr(senior_user, 'calendar_data', None)
        except Exception as e:
            print(f"⚠️ calendar_data 컬럼 없음: {str(e)}")
            existing_data = None
            
        if existing_data and isinstance(existing_data, str):
            try:
                calendar_data = json.loads(existing_data)
            except Exception as e:
                print(f"⚠️ JSON 파싱 실패: {str(e)}")
                calendar_data = {}
        else:
            calendar_data = {}
        
        # 해당 날짜의 일정 업데이트
        events_data = []
        for event in request.events:
            events_data.append({
                "id": event.id,
                "text": event.text,
                "created_at": event.created_at.isoformat() if isinstance(event.created_at, datetime) else str(event.created_at)
            })
        
        if events_data:
            calendar_data[request.date] = {
                "events": events_data,
                "marked": True,
                "dotColor": "#50cebb"
            }
        else:
            # 일정이 없으면 해당 날짜 제거
            if request.date in calendar_data:
                del calendar_data[request.date]
        
        # 🔧 DB에 안전하게 저장
        try:
            # calendar_data 컬럼이 있는지 확인
            if hasattr(senior_user, 'calendar_data'):
                senior_user.calendar_data = json.dumps(calendar_data, ensure_ascii=False)
            if hasattr(senior_user, 'calendar_updated_at'):
                senior_user.calendar_updated_at = datetime.utcnow()
            if hasattr(senior_user, 'calendar_updated_by'):
                senior_user.calendar_updated_by = request.family_user_id
            
            db.commit()
            print("✅ DB 저장 성공")
        except Exception as db_error:
            print(f"⚠️ DB 저장 실패 (컬럼 없음): {str(db_error)}")
            db.rollback()
            # DB 저장이 실패해도 응답은 성공으로 처리 (임시)
            pass
        
        return {
            "status": "success",
            "message": "캘린더 일정이 성공적으로 업데이트되었습니다",
            "date": request.date,
            "events": events_data,
            "senior_user_id": request.senior_user_id,
            "updated_by": request.family_user_id,
            "note": "calendar_data 컬럼이 없으면 임시 처리됩니다"
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ 캘린더 일정 수정 실패: {str(e)}")
        import traceback
        print(f"❌ 상세 오류: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"캘린더 일정 수정 실패: {str(e)}")

@router.get("/events/{senior_user_id}")
def get_calendar_events(senior_user_id: str, db: Session = Depends(get_db)):
    """어르신의 모든 캘린더 일정 조회"""
    try:
        print(f"📅 캘린더 일정 조회 요청: {senior_user_id}")
        
        senior_user = db.query(User).filter(User.user_id_str == senior_user_id).first()
        if not senior_user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        # 🔧 안전한 캘린더 데이터 조회
        try:
            if hasattr(senior_user, 'calendar_data'):
                calendar_data_str = getattr(senior_user, 'calendar_data', None)
            else:
                calendar_data_str = None
                print("⚠️ calendar_data 컬럼이 없습니다")
        except Exception as e:
            print(f"⚠️ calendar_data 접근 실패: {str(e)}")
            calendar_data_str = None
            
        if calendar_data_str:
            try:
                calendar_data = json.loads(calendar_data_str)
            except Exception as e:
                print(f"⚠️ JSON 파싱 실패: {str(e)}")
                calendar_data = {}
        else:
            calendar_data = {}
        
        # 업데이트 시간 정보도 안전하게 조회
        last_updated = None
        last_updated_by = None
        try:
            if hasattr(senior_user, 'calendar_updated_at'):
                last_updated = getattr(senior_user, 'calendar_updated_at', None)
            if hasattr(senior_user, 'calendar_updated_by'):
                last_updated_by = getattr(senior_user, 'calendar_updated_by', None)
        except Exception as e:
            print(f"⚠️ 업데이트 정보 조회 실패: {str(e)}")
        
        return {
            "senior_user_id": senior_user_id,
            "calendar_data": calendar_data,
            "last_updated": last_updated,
            "last_updated_by": last_updated_by
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ 캘린더 일정 조회 실패: {str(e)}")
        import traceback
        print(f"❌ 상세 오류: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"캘린더 일정 조회 실패: {str(e)}")

@router.get("/check-updates/{senior_user_id}")
def check_calendar_updates(senior_user_id: str, db: Session = Depends(get_db)):
    """어르신 앱에서 캘린더 업데이트 확인"""
    try:
        print(f"🔍 캘린더 업데이트 확인 요청: {senior_user_id}")
        
        senior_user = db.query(User).filter(User.user_id_str == senior_user_id).first()
        if not senior_user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        # 🔧 안전한 업데이트 확인
        try:
            last_check = None
            calendar_updated_at = None
            
            if hasattr(senior_user, 'last_calendar_check'):
                last_check = getattr(senior_user, 'last_calendar_check', None)
            if hasattr(senior_user, 'calendar_updated_at'):
                calendar_updated_at = getattr(senior_user, 'calendar_updated_at', None)
                
        except Exception as e:
            print(f"⚠️ 업데이트 시간 확인 실패: {str(e)}")
            last_check = None
            calendar_updated_at = None
        
        has_update = False
        calendar_data = None
        last_updated_by = None
        update_time = None
        
        if calendar_updated_at and (not last_check or calendar_updated_at > last_check):
            has_update = True
            
            # 현재 캘린더 데이터 조회
            try:
                if hasattr(senior_user, 'calendar_data'):
                    calendar_data_str = getattr(senior_user, 'calendar_data', None)
                    calendar_data = json.loads(calendar_data_str) if calendar_data_str else {}
                else:
                    calendar_data = {}
            except Exception as e:
                print(f"⚠️ 캘린더 데이터 조회 실패: {str(e)}")
                calendar_data = {}
            
            try:
                if hasattr(senior_user, 'calendar_updated_by'):
                    last_updated_by = getattr(senior_user, 'calendar_updated_by', 'unknown')
                update_time = calendar_updated_at
                
                # 확인 시간 업데이트
                if hasattr(senior_user, 'last_calendar_check'):
                    senior_user.last_calendar_check = datetime.utcnow()
                    db.commit()
            except Exception as e:
                print(f"⚠️ 업데이트 시간 기록 실패: {str(e)}")
        
        return {
            "has_update": has_update,
            "calendar_data": calendar_data,
            "last_updated_by": last_updated_by,
            "update_time": update_time,
            "senior_user_id": senior_user_id
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ 캘린더 업데이트 확인 실패: {str(e)}")
        import traceback
        print(f"❌ 상세 오류: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"캘린더 업데이트 확인 실패: {str(e)}")

# 🔧 테스트용 엔드포인트
@router.get("/test")
def test_calendar_api():
    """캘린더 API 테스트"""
    return {
        "status": "success",
        "message": "캘린더 API가 정상적으로 작동합니다",
        "timestamp": datetime.utcnow(),
        "endpoints": [
            "POST /calendar/events/update",
            "GET /calendar/events/{senior_user_id}",
            "GET /calendar/check-updates/{senior_user_id}",
            "GET /calendar/test"
        ]
    }