# app/core/config.py

import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    """
    애플리케이션의 모든 환경 변수를 관리하는 설정 클래스입니다.
    """
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding='utf-8',
        extra='ignore'
    )

    # --- API Keys & Vector DB ---
    OPENAI_API_KEY: str
    PINECONE_API_KEY: str
    PINECONE_INDEX_NAME: str = "long-term-memory"

    # --- MySQL Database ---
    MYSQL_USER: str
    MYSQL_PASSWORD: str
    MYSQL_HOST: str
    MYSQL_DATABASE: str
    MYSQL_PORT: int = 3306
    MYSQL_ROOT_PASSWORD: str

    # --- Paths (경로 수정) ---
    # config.py -> core -> app -> backend (세 단계 위로 이동)
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    PROMPTS_DIR: str = os.path.join(BASE_DIR, "prompts")

    @property
    def DATABASE_URL(self) -> str:
        """SQLAlchemy에서 사용할 데이터베이스 연결 URL을 생성합니다."""
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@"
            f"{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}?charset=utf8mb4"
        )
    
    # ... (나머지 property들은 그대로 유지) ...
    @property
    def SERVER_DATABASE_URL(self) -> str:
        """DB를 생성하는 등 서버 자체에 연결할 때 사용할 URL을 생성합니다."""
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@"
            f"{self.MYSQL_HOST}:{self.MYSQL_PORT}?charset=utf8mb4"
        )

    @property
    def DB_CONFIG(self) -> dict:
        """백그라운드 스크립트 등에서 직접 DB에 연결할 때 사용할 설정 딕셔너리를 생성합니다."""
        return {
            'host': self.MYSQL_HOST,
            'user': self.MYSQL_USER,
            'password': self.MYSQL_PASSWORD,
            'database': self.MYSQL_DATABASE,
            'port': self.MYSQL_PORT
        }

@lru_cache()
def get_settings():
    """캐싱된 설정 객체를 반환하는 함수"""
    return Settings()

settings = get_settings()