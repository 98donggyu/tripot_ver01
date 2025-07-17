from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# ❌ 이 줄들을 완전히 삭제하세요!
# from .models import User, Conversation, Summary
# 그리고 제가 추가하라고 한 함수들도 모두 삭제하세요!

SQLALCHEMY_DATABASE_URL = f"mysql+pymysql://{settings.MYSQL_USER}:{settings.MYSQL_PASSWORD}@{settings.DB_HOST}/{settings.MYSQL_DATABASE}"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()