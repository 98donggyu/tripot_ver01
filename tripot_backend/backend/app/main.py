print("🔥🔥🔥 MAIN.PY 시작! 🔥🔥🔥")
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio

print("🔥 IMPORTS 완료")
from app.db import models
from app.db.database import engine
from app.api.v1.api import api_router

print("🔥 API 라우터 임포트 완료")

# 서버 시작 시 models.py에 정의된 모든 테이블을 DB에 생성합니다.
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Tripot API",
    description="트라이팟 서비스의 통합 API 서버입니다.",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# '/api/v1' 경로로 들어오는 모든 요청을 api_router에게 위임합니다.
app.include_router(api_router, prefix="/api/v1")

# 서버 상태 확인용 루트 경로
@app.get("/", tags=["Default"])
def read_root():
    return {"message": "Welcome to Tripot Integrated Backend!"}

# ✨ 서버 시작 시 스케줄러 자동 시작
@app.on_event("startup")
async def startup_event():
    """서버 시작 시 실행되는 이벤트"""
    try:
        print("🚀 서버 시작 - 스케줄러 초기화 중...")
        
        # 스케줄러 서비스 시작
        from app.services.schedule_service import scheduler_service
        
        # 백그라운드에서 스케줄러 실행
        asyncio.create_task(scheduler_service.start_scheduler())
        
        print("✅ 정시 대화 스케줄러가 백그라운드에서 시작되었습니다")
        
    except Exception as e:
        print(f"❌ 스케줄러 시작 실패: {str(e)}")
        # 스케줄러 실패해도 서버는 계속 실행

@app.on_event("shutdown") 
async def shutdown_event():
    """서버 종료 시 실행되는 이벤트"""
    try:
        print("⏹️ 서버 종료 - 스케줄러 정리 중...")
        
        from app.services.schedule_service import scheduler_service
        scheduler_service.stop_scheduler()
        
        print("✅ 스케줄러가 정상적으로 종료되었습니다")
        
    except Exception as e:
        print(f"❌ 스케줄러 종료 중 오류: {str(e)}")

# 스케줄러 상태 확인 엔드포인트
@app.get("/scheduler-status", tags=["Default"])
def get_scheduler_status():
    """스케줄러 상태 확인"""
    try:
        from app.services.schedule_service import scheduler_service
        return {
            "scheduler_running": scheduler_service.is_running,
            "active_schedules_count": len(scheduler_service.get_all_active_schedules())
        }
    except Exception as e:
        return {"error": str(e)}