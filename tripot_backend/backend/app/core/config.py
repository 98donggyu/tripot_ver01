import os
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    """
    애플리케이션의 모든 환경 변수를 관리하는 설정 클래스입니다.
    Docker 환경에서는 docker-compose에 의해 주입된 환경 변수를 자동으로 읽어옵니다.
    """
    # OpenAI
    OPENAI_API_KEY: str

    # Pinecone
    PINECONE_API_KEY: str
    PINECONE_INDEX_NAME: str = "long-term-memory"

    # MySQL Database
    MYSQL_DATABASE: str
    MYSQL_USER: str
    MYSQL_PASSWORD: str
    DB_HOST: str # ❗️오류 해결을 위해 MYSQL_HOST에서 다시 DB_HOST로 변경
    MYSQL_ROOT_PASSWORD: str

    @property
    def DATABASE_URL(self) -> str:
        """
        SQLAlchemy에서 사용할 데이터베이스 연결 URL을 생성합니다.
        """
        # DB_HOST를 사용하도록 수정
        return f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.DB_HOST}/{self.MYSQL_DATABASE}?charset=utf8mb4"

# 설정 객체를 생성하고 캐싱합니다.
@lru_cache()
def get_settings():
    return Settings()

# 다른 파일에서 쉽게 가져다 쓸 수 있도록 전역 변수로 인스턴스를 생성합니다.
settings = get_settings()