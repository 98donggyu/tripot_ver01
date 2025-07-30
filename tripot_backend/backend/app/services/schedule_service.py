# app/services/schedule_service.py

import asyncio
import schedule
from datetime import datetime
import pytz
from app.db.database import SessionLocal
from app.db import crud
from app.services.connection_manager import manager # ◀️ 중앙 ConnectionManager를 가져옵니다.

KST = pytz.timezone('Asia/Seoul')

class ScheduleManager:
    """정시 대화 알림 스케줄러를 관리하는 클래스"""
    def __init__(self):
        self.is_running = False

    def setup_daily_schedules(self):
        """DB에서 모든 활성 스케줄을 가져와 스케줄러에 등록합니다."""
        schedule.clear()
        db = SessionLocal()
        try:
            # crud 함수를 통해 스케줄 정보를 가져옵니다.
            active_schedules = crud.get_all_active_schedules(db) 
            
            print(f"🕒 현재 한국시간: {datetime.now(KST).strftime('%Y-%m-%d %H:%M:%S')}")
            for user_id_str, call_time_str in active_schedules:
                # 한국 시간 기준으로 스케줄 등록
                schedule.every().day.at(call_time_str, "Asia/Seoul").do(
                    lambda uid=user_id_str: asyncio.create_task(self.trigger_scheduled_call(uid))
                )
                print(f"⏰ {user_id_str} 사용자, 한국시간 {call_time_str}에 스케줄 등록")
            
            print(f"✅ 총 {len(active_schedules)}개의 스케줄 등록 완료")
        finally:
            db.close()

    async def trigger_scheduled_call(self, user_id: str):
        """정시 대화 알림을 웹소켓으로 전송합니다."""
        try:
            current_time_str = datetime.now(KST).strftime('%H:%M')
            print(f"📞 [{user_id}] 사용자에게 정시 대화 알림! (현재 한국시간: {current_time_str})")
            
            await manager.send_json({
                "type": "scheduled_call",
                "content": "정시 대화 시간입니다! 대화를 시작하시겠어요?",
                "timestamp": datetime.now().isoformat()
            }, user_id)

        except Exception as e:
            print(f"❌ 정시 대화 알림 전송 실패: {user_id}, {e}")

    async def start(self):
        """스케줄러를 시작하고 1분마다 작업을 확인합니다."""
        if self.is_running: return
        self.is_running = True
        print("🚀 정시 대화 스케줄러 시작")
        self.setup_daily_schedules()
        
        while self.is_running:
            schedule.run_pending()
            await asyncio.sleep(60)

    def stop(self):
        """스케줄러를 중지합니다."""
        self.is_running = False
        schedule.clear()
        print("⏹️ 정시 대화 스케줄러 중지")

# 전역 스케줄러 인스턴스 생성
scheduler_service = ScheduleManager()