import os
from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.services import report_service
from app.services.photo_service import PhotoService
from app.db.models import FamilyPhoto, User  # 🔧 PhotoComment 제거

router = APIRouter()

# 🔧 CommentCreate 클래스 임시 주석
# class CommentCreate(BaseModel):
#     user_id_str: str
#     author_name: str
#     comment_text: str

@router.get("/reports/{senior_user_id}")
def get_senior_report_api(senior_user_id: str, db: Session = Depends(get_db)):
    report_data = report_service.get_report_by_user_id(db, senior_user_id)
    return report_data

@router.post("/family-yard/upload")
async def upload_photo(
    file: UploadFile = File(...),
    user_id_str: str = Form(...),
    uploaded_by: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        print(f"📸 사진 업로드 요청 받음: user={user_id_str}, uploader={uploaded_by}")
        
        user = db.query(User).filter(User.user_id_str == user_id_str).first()
        if not user:
            print(f"❌ 사용자를 찾을 수 없음: {user_id_str}")
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        print(f"✅ 사용자 확인됨: {user.user_id_str}")
        
        contents = await file.read()
        print(f"📄 파일 읽기 완료: {len(contents)} bytes")
        
        upload_path, unique_filename_base = PhotoService.generate_file_path()
        file_extension = os.path.splitext(file.filename)[1].lower()
        unique_filename = f"{unique_filename_base}{file_extension}"
        file_path = os.path.join(upload_path, unique_filename)
        
        print(f"📁 파일 저장 경로: {file_path}")
        
        with open(file_path, "wb") as f:
            f.write(contents)
        
        print(f"💾 파일 저장 완료")
        
        photo = PhotoService.save_photo_metadata(
            db=db, user=user, filename=unique_filename, original_name=file.filename,
            file_path=file_path, file_size=len(contents), uploaded_by=uploaded_by
        )
        
        print(f"✅ DB 저장 완료: photo_id={photo.id}")
        
        return {"status": "success", "photo_id": photo.id, "message": "사진이 성공적으로 업로드되었습니다"}
    except Exception as e:
        print(f"❌ 업로드 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"업로드 실패: {str(e)}")

@router.get("/family-yard/photos")
def get_family_photos(
    user_id_str: str,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    try:
        print(f"📷 사진 목록 조회 요청: user={user_id_str}")
        
        user = db.query(User).filter(User.user_id_str == user_id_str).first()
        if not user:
            print(f"❌ 사용자를 찾을 수 없음: {user_id_str}")
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        photos = PhotoService.get_photos_by_user(db, user, limit)
        photos_by_date = PhotoService.group_photos_by_date(photos)
        
        print(f"✅ 사진 목록 조회 완료: {len(photos)}개")
        
        return {
            "status": "success",
            "photos_by_date": photos_by_date,
            "total_count": len(photos)
        }
    except Exception as e:
        print(f"❌ 사진 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"조회 실패: {str(e)}")

# 🔧 댓글 관련 엔드포인트 임시 주석
# @router.post("/family-yard/photo/{photo_id}/comment")
# def create_comment_for_photo(
#     photo_id: int,
#     comment_data: CommentCreate,
#     db: Session = Depends(get_db)
# ):
#     ...

@router.get("/family-yard/photo/{photo_id}")
def get_photo_file(photo_id: int, db: Session = Depends(get_db)):
    try:
        photo = PhotoService.get_photo_by_id(db, photo_id)
        if not photo or not os.path.exists(photo.file_path):
            raise HTTPException(status_code=404, detail="사진 파일을 찾을 수 없습니다")
        
        media_type = "image/jpeg"
        if photo.original_name and photo.original_name.lower().endswith('.png'):
            media_type = "image/png"

        return FileResponse(photo.file_path, media_type=media_type)
    except Exception as e:
        print(f"❌ 사진 파일 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"사진 파일 조회 실패: {str(e)}")