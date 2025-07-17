from fastapi import APIRouter

# 1. endpoints 폴더에 있는 각 기능별 라우터 파일을 불러옵니다.
from .endpoints import senior, family, auth

# 2. v1 API 전체를 대표할 새로운 APIRouter 객체를 생성합니다.
api_router = APIRouter()

# 3. 불러온 각 기능별 라우터를 v1 라우터에 포함시킵니다.
# 🔧 senior는 prefix 없이, family만 prefix 사용
api_router.include_router(senior.router, tags=["Senior"])  # prefix 제거
api_router.include_router(family.router, prefix="/family", tags=["Family"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])