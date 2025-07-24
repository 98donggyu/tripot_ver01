from fastapi import APIRouter

# 1. endpoints 폴더에 있는 각 기능별 라우터 파일을 불러옵니다.
from .endpoints import senior, family, auth

# 2. schedule과 calendar 라우터 import
try:
    from .endpoints import schedule
    SCHEDULE_AVAILABLE = True
    print("✅ schedule 모듈 import 성공")
except ImportError as e:
    print(f"❌ schedule 모듈 import 실패: {str(e)}")
    SCHEDULE_AVAILABLE = False

try:
    from .endpoints import calendar
    CALENDAR_AVAILABLE = True
    print("✅ calendar 모듈 import 성공")
except ImportError as e:
    print(f"❌ calendar 모듈 import 실패: {str(e)}")
    CALENDAR_AVAILABLE = False

# 3. v1 API 전체를 대표할 새로운 APIRouter 객체를 생성합니다.
api_router = APIRouter()

# 4. 불러온 각 기능별 라우터를 v1 라우터에 포함시킵니다.
# 🔧 senior는 prefix 없이, family만 prefix 사용
api_router.include_router(senior.router, tags=["Senior"])  # prefix 제거
api_router.include_router(family.router, prefix="/family", tags=["Family"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# ✨ 스케줄 라우터 등록
if SCHEDULE_AVAILABLE:
    api_router.include_router(schedule.router, prefix="/schedule", tags=["Schedule"])
    print("✅ schedule 라우터 등록됨")
else:
    print("❌ schedule 라우터 등록 실패")

# ✨ 캘린더 라우터 등록
if CALENDAR_AVAILABLE:
    api_router.include_router(calendar.router, prefix="/calendar", tags=["Calendar"])
    print("✅ calendar 라우터 등록됨")
else:
    print("❌ calendar 라우터 등록 실패")

print("🔗 API 라우터 초기화 완료")
print("📍 등록된 라우터:")
print("  - Senior (no prefix)")
print("  - Family (/family)")
print("  - Auth (/auth)")
if SCHEDULE_AVAILABLE:
    print("  - Schedule (/schedule)")
if CALENDAR_AVAILABLE:
    print("  - Calendar (/calendar)")