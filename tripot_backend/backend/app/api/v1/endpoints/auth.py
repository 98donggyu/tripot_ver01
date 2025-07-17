from fastapi import APIRouter

# '/auth' 라는 접두사를 가진 라우터를 생성합니다.
# 이 파일에는 앞으로 로그인, 회원가입 등 인증 관련 API가 추가될 예정입니다.
router = APIRouter()

@router.post("/login")
def login():
    # TODO: 로그인 로직 구현
    return {"message": "Login endpoint placeholder"}