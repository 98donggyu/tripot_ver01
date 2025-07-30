# app/database.py

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from app.core.config import settings

# 데이터베이스 연결 설정
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def init_db():
    """
    서버 시작 시 데이터베이스와 모든 테이블을 확인하고 생성합니다.
    """
    try:
        # DB가 없으면 생성 (최초 실행 시 필요)
        server_engine = create_engine(settings.SERVER_DATABASE_URL, echo=True)
        with server_engine.connect() as connection:
            connection.execute(text(f"CREATE DATABASE IF NOT EXISTS {settings.MYSQL_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
        
        # models.py에 정의된 모든 테이블을 생성
        # Base.metadata.create_all()이 이미 존재하는 테이블은 건너뜁니다.
        from . import models # models.py를 임포트하여 Base에 테이블 정보가 등록되도록 함
        Base.metadata.create_all(bind=engine)
        
        print("✅ 데이터베이스 및 모든 테이블이 성공적으로 준비되었습니다.")
    except Exception as e:
        print(f"❌ 데이터베이스 설정 중 오류 발생: {e}")
        raise

def get_db():
    """FastAPI 의존성 주입을 위한 DB 세션 생성기"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()