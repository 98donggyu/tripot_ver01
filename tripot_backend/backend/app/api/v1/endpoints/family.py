# app/api/v1/endpoints/family.py

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Response
from sqlalchemy.orm import Session
from typing import List, Dict
import traceback # 상세 오류 출력을 위해 추가

from app.db.database import get_db
from app.db import crud
from app.services import report_service, photo_service
from app import schemas

router = APIRouter()

# --- Reports (변경 없음) ---
@router.get("/reports/{senior_user_id}", response_model=schemas.SeniorReportSummary)
def get_home_screen_report(senior_user_id: str, db: Session = Depends(get_db)):
    report_data = report_service.get_home_screen_report(db, senior_user_id)
    if not report_data:
        raise HTTPException(status_code=404, detail="해당 사용자의 리포트를 찾을 수 없습니다.")
    return report_data

@router.get("/reports/detail/{senior_user_id}")
def get_full_detail_report(senior_user_id: str, db: Session = Depends(get_db)):
    report_data = report_service.get_full_report(db, senior_user_id)
    if not report_data:
        raise HTTPException(status_code=404, detail="해당 사용자의 상세 리포트를 찾을 수 없습니다.")
    return report_data

# --- Family Yard (Photos & Comments) ---

# 🔽🔽🔽 사진 업로드 함수를 아래 내용으로 전체 교체해주세요 🔽🔽🔽
@router.post("/family-yard/upload")
async def upload_photo(
    file: UploadFile = File(...),
    user_id_str: str = Form(...),
    uploaded_by: str = Form(...),
    db: Session = Depends(get_db)
):
    print("--- 📸 사진 업로드 API 시작 ---")
    try:
        # 1. 사용자 확인
        print(f"1. 사용자 조회 시도: {user_id_str}")
        user = crud.get_user_by_user_id_str(db, user_id_str)
        if not user:
            print(f"❌ 사용자 없음: {user_id_str}")
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        print(f"✅ 사용자 확인 완료: ID={user.id}")

        # 2. 파일 경로 생성
        print("2. 파일 저장 경로 생성 시도...")
        file_path, unique_filename = photo_service.generate_file_path(file.filename)
        print(f"✅ 파일 경로 생성 완료: {file_path}")

        # 3. 파일 내용 읽기
        print("3. 파일 내용 읽기 시도...")
        contents = await file.read()
        file_size = len(contents)
        print(f"✅ 파일 내용 읽기 완료: {file_size} bytes")
        
        # 4. 파일 시스템에 저장
        print("4. 파일 시스템에 저장 시도...")
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        print("✅ 파일 시스템에 저장 완료")

        # 5. 데이터베이스에 메타데이터 저장
        print("5. DB에 메타데이터 저장 시도...")
        photo = crud.create_photo(
            db=db, user_id=user.id, filename=unique_filename,
            original_name=file.filename, file_path=file_path,
            file_size=file_size, # file.size 대신 실제 읽은 크기 사용 (버그 수정)
            uploaded_by=uploaded_by
        )
        print(f"✅ DB 저장 완료: Photo ID={photo.id}")
        
        print("--- ✅ 사진 업로드 API 성공 ---")
        return {"status": "success", "photo_id": photo.id}

    except Exception as e:
        print(f"--- ❌ 사진 업로드 API 오류 발생 ---")
        print(f"오류 타입: {type(e).__name__}")
        print(f"오류 메시지: {e}")
        print("--- 상세 Traceback ---")
        traceback.print_exc()
        print("--------------------")
        raise HTTPException(status_code=500, detail=f"서버 내부 오류: {e}")


# --- 나머지 엔드포인트는 변경 없음 ---
@router.get("/family-yard/photos/{user_id_str}")
def get_family_photos(user_id_str: str, limit: int = 50, db: Session = Depends(get_db)):
    user = crud.get_user_by_user_id_str(db, user_id_str)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    photos = crud.get_photos_by_user_id(db, user.id, limit)
    photos_by_date = photo_service.group_photos_by_date(photos)
    
    return { "status": "success", "photos_by_date": photos_by_date }
    
@router.get("/family-yard/photo/{photo_id}")
def get_photo_file(photo_id: int, db: Session = Depends(get_db)):
    photo = crud.get_photo_by_id(db, photo_id)
    if not photo or not photo_service.photo_exists(photo.file_path):
        raise HTTPException(status_code=404, detail="사진 파일을 찾을 수 없습니다.")
    return photo_service.get_photo_response(photo.file_path)

@router.post("/family-yard/photo/{photo_id}/comment", response_model=schemas.Comment)
def create_comment_for_photo(
    photo_id: int,
    comment_data: schemas.CommentCreate,
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_user_id_str(db, comment_data.user_id_str)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    photo = crud.get_photo_by_id(db, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="사진을 찾을 수 없습니다.")

    return crud.create_comment(
        db=db, photo_id=photo_id, user_id=user.id,
        author_name=comment_data.author_name, text=comment_data.comment_text
    )