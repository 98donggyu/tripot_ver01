import asyncio
import schedule
import time
from datetime import datetime, time as datetime_time
from typing import List
import pytz
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import User, ConversationSchedule
from fastapi import HTTPException

# 한국 시간대 설정
KST = pytz.timezone('Asia/Seoul')

class ScheduleService:
    def __init__(self):
        self.is_running = False

    @staticmethod
    def set_user_schedule(db: Session, user_id_str: str, call_times: List[str]) -> List[ConversationSchedule]:
        """사용자의 정시 대화 시간 설정 (한국 시간 기준)"""
        try:
            print(f"⏰ {user_id_str} 사용자 스케줄 설정 시작 (한국시간): {call_times}")
            
            # 사용자 찾기
            user = db.query(User).filter(User.user_id_str == user_id_str).first()
            if not user:
                raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
            
            # 기존 스케줄 모두 삭제
            db.query(ConversationSchedule).filter(ConversationSchedule.user_id == user.id).delete()
            
            # 새 스케줄 생성
            schedules = []
            for time_str in call_times:
                # "12:00" -> datetime.time(12, 0) 변환 (한국 시간)
                hour, minute = map(int, time_str.split(':'))
                call_time = datetime_time(hour, minute)
                
                schedule = ConversationSchedule(
                    user_id=user.id,
                    call_time=call_time,
                    is_enabled=True
                )
                db.add(schedule)
                schedules.append(schedule)
            
            db.commit()
            print(f"✅ {user_id_str} 스케줄 설정 완료 (한국시간): {len(schedules)}개")
            return schedules
            
        except Exception as e:
            print(f"❌ 스케줄 설정 실패: {str(e)}")
            db.rollback()
            raise HTTPException(status_code=500, detail=f"스케줄 설정 실패: {str(e)}")

    @staticmethod
    def get_user_schedules(db: Session, user_id_str: str) -> List[ConversationSchedule]:
        """사용자의 현재 스케줄 조회"""
        try:
            user = db.query(User).filter(User.user_id_str == user_id_str).first()
            if not user:
                return []
            
            schedules = db.query(ConversationSchedule).filter(
                ConversationSchedule.user_id == user.id,
                ConversationSchedule.is_enabled == True
            ).all()
            
            print(f"📋 {user_id_str} 활성 스케줄 (한국시간): {len(schedules)}개")
            return schedules
            
        except Exception as e:
            print(f"❌ 스케줄 조회 실패: {str(e)}")
            return []

    @staticmethod
    def toggle_schedule(db: Session, schedule_id: int, is_enabled: bool) -> bool:
        """특정 스케줄 활성화/비활성화"""
        try:
            schedule = db.query(ConversationSchedule).filter(ConversationSchedule.id == schedule_id).first()
            if not schedule:
                raise HTTPException(status_code=404, detail="스케줄을 찾을 수 없습니다")
            
            schedule.is_enabled = is_enabled
            db.commit()
            
            print(f"✅ 스케줄 {schedule_id} {'활성화' if is_enabled else '비활성화'}")
            return True
            
        except Exception as e:
            print(f"❌ 스케줄 토글 실패: {str(e)}")
            db.rollback()
            return False

    @staticmethod
    def get_all_active_schedules() -> List[tuple]:
        """모든 활성 스케줄 조회 (스케줄러용) - 한국시간 기준"""
        db = SessionLocal()
        try:
            schedules = db.query(ConversationSchedule, User).join(User).filter(
                ConversationSchedule.is_enabled == True
            ).all()
            
            result = []
            for schedule, user in schedules:
                # 한국 시간으로 표시
                time_str = schedule.call_time.strftime("%H:%M")
                result.append((user.user_id_str, time_str))
            
            print(f"📊 총 활성 스케줄 (한국시간): {len(result)}개")
            return result
            
        except Exception as e:
            print(f"❌ 전체 스케줄 조회 실패: {str(e)}")
            return []
        finally:
            db.close()

    def get_current_korea_time(self):
        """현재 한국 시간 반환"""
        return datetime.now(KST)

    async def trigger_scheduled_call(self, user_id: str):
        """정시 대화 트리거 (한국시간 기준)"""
        try:
            current_time = self.get_current_korea_time()
            print(f"📞 {user_id} 사용자 정시 대화 시작! (한국시간: {current_time.strftime('%H:%M')})")
            
            # WebSocket을 통해 클라이언트에게 알림 전송
            from app.api.v1.endpoints.senior import manager
            
            if user_id in manager.active_connections:
                await manager.send_json({
                    "type": "scheduled_call",
                    "content": "정시 대화 시간입니다! 대화를 시작하시겠어요?",
                    "timestamp": current_time.isoformat(),
                    "korea_time": current_time.strftime('%Y-%m-%d %H:%M:%S')
                }, user_id)
                print(f"✅ {user_id}에게 정시 대화 알림 전송 (한국시간)")
            else:
                print(f"⚠️ {user_id} 사용자가 현재 접속하지 않음")
                
        except Exception as e:
            print(f"❌ 정시 대화 트리거 실패: {user_id}, {str(e)}")

    def setup_daily_schedules(self):
        """일일 스케줄 설정 (한국시간 기준)"""
        try:
            # 기존 스케줄 모두 제거
            schedule.clear()
            
            # 활성 스케줄 가져와서 등록
            active_schedules = self.get_all_active_schedules()
            current_time = self.get_current_korea_time()
            
            print(f"🕒 현재 한국시간: {current_time.strftime('%Y-%m-%d %H:%M:%S')}")
            
            for user_id, call_time in active_schedules:
                # 한국 시간 기준으로 스케줄 등록
                schedule.every().day.at(call_time).do(
                    lambda uid=user_id, time=call_time: asyncio.create_task(self.trigger_scheduled_call(uid))
                )
                print(f"⏰ {user_id} 사용자 한국시간 {call_time} 스케줄 등록")
            
            print(f"✅ 총 {len(active_schedules)}개 스케줄 등록 완료 (한국시간 기준)")
            
        except Exception as e:
            print(f"❌ 스케줄 설정 실패: {str(e)}")

    async def start_scheduler(self):
        """스케줄러 시작 (한국시간 기준)"""
        self.is_running = True
        print("🚀 정시 대화 스케줄러 시작 (한국시간 기준)")
        
        # 시작 시 스케줄 설정
        self.setup_daily_schedules()
        
        while self.is_running:
            schedule.run_pending()
            await asyncio.sleep(60)  # 1분마다 체크
            
            # 매일 한국시간 자정에 스케줄 재설정
            current_time = self.get_current_korea_time()
            if current_time.strftime("%H:%M") == "00:00":
                print("🔄 한국시간 자정 - 스케줄 재설정")
                self.setup_daily_schedules()

    def stop_scheduler(self):
        """스케줄러 중지"""
        self.is_running = False
        schedule.clear()
        print("⏹️ 정시 대화 스케줄러 중지")

# 전역 스케줄러 인스턴스
scheduler_service = ScheduleService()