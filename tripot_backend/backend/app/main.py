# app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio

# --- 우리가 만든 모듈들을 임포트 ---
from app.db import database
from app.api.v1.api import api_router

app = FastAPI(
    title="Tripot API",
    description="트라이팟 서비스의 통합 API 서버입니다.",
    version="1.0.0"
)

# --- CORS 미들웨어 설정 ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API 라우터 포함 ---
app.include_router(api_router, prefix="/api/v1")

# --- 서버 시작/종료 이벤트 처리 ---
@app.on_event("startup")
async def startup_event():
    """서버가 시작될 때 실행됩니다."""
    try:
        print("🚀 서버 시작 - 데이터베이스 및 스케줄러 초기화...")
        
        # 1. 데이터베이스 초기화
        database.init_db()
        
        # 2. 정시 대화 스케줄러 시작
        from app.services.schedule_service import scheduler_service
        # 🔽🔽🔽 함수 이름 수정 🔽🔽🔽
        asyncio.create_task(scheduler_service.start()) 
        
        print("✅ 서버가 성공적으로 시작되었습니다.")
        
    except Exception as e:
        print(f"❌ 서버 시작 중 오류 발생: {e}")
        raise RuntimeError("서버 시작 실패") from e

@app.on_event("shutdown") 
async def shutdown_event():
    """서버가 종료될 때 실행됩니다."""
    try:
        print("⏹️ 서버 종료 - 스케줄러 정리 중...")
        from app.services.schedule_service import scheduler_service
        # 🔽🔽🔽 함수 이름 수정 🔽�🔽
        scheduler_service.stop()
        print("✅ 스케줄러가 정상적으로 종료되었습니다.")
    except Exception as e:
        print(f"❌ 스케줄러 종료 중 오류 발생: {e}")

# --- 기본 엔드포인트 ---
@app.get("/", tags=["Root"])
def read_root():
    """서버 상태 확인용 루트 경로"""
    return {"message": "Welcome to Tripot Integrated Backend!"}