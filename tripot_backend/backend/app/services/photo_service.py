import os
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional
from sqlalchemy.orm import Session, joinedload
from app.db.models import FamilyPhoto, User

class PhotoService:
    @staticmethod
    def generate_file_path(base_dir: str = "uploads/family_photos") -> tuple[str, str]:
        today = datetime.now()
        date_folder = f"{today.year}/{today.month:02d}/{today.day:02d}"
        upload_path = os.path.join(base_dir, date_folder)
        os.makedirs(upload_path, exist_ok=True)
        unique_filename = f"{uuid.uuid4()}"
        return upload_path, unique_filename

    @staticmethod
    def save_photo_metadata(db: Session, user: User, filename: str, original_name: str, file_path: str, file_size: int, uploaded_by: str) -> FamilyPhoto:
        # 🔧 명시적으로 현재 시간 설정
        current_time = datetime.now(timezone.utc)
        
        photo = FamilyPhoto(
            user_id=user.id, 
            filename=filename, 
            original_name=original_name,
            file_path=file_path, 
            file_size=file_size, 
            uploaded_by=uploaded_by,
            created_at=current_time  # 🔧 명시적 시간 설정
        )
        db.add(photo)
        db.commit()
        db.refresh(photo)
        
        # 🔧 저장 후 created_at 확인
        print(f"✅ 사진 저장 완료 - ID: {photo.id}, created_at: {photo.created_at}")
        
        return photo

    @staticmethod
    def get_photos_by_user(db: Session, user: User, limit: int = 50) -> List[FamilyPhoto]:
        photos = db.query(FamilyPhoto)\
                   .filter(FamilyPhoto.user_id == user.id)\
                   .order_by(FamilyPhoto.created_at.desc())\
                   .limit(limit)\
                   .all()
        
        # 🔧 조회된 사진들의 created_at 확인
        print(f"📷 조회된 사진 개수: {len(photos)}")
        for photo in photos:
            print(f"  - ID: {photo.id}, created_at: {photo.created_at}, filename: {photo.filename}")
        
        return photos

    @staticmethod
    def get_photo_by_id(db: Session, photo_id: int) -> Optional[FamilyPhoto]:
        return db.query(FamilyPhoto).filter(FamilyPhoto.id == photo_id).first()

    @staticmethod
    def group_photos_by_date(photos: List[FamilyPhoto]) -> Dict[str, List[Dict]]:
        photos_by_date = {}
        
        for photo in photos:
            # 🔧 created_at이 NULL인 경우 처리
            if photo.created_at is None:
                print(f"⚠️ 경고: photo.id={photo.id}의 created_at이 NULL입니다")
                # NULL인 경우 오늘 날짜로 처리
                date_key = datetime.now().strftime('%Y-%m-%d')
            else:
                date_key = photo.created_at.strftime('%Y-%m-%d')
            
            if date_key not in photos_by_date:
                photos_by_date[date_key] = []
            
            photos_by_date[date_key].append({
                "id": photo.id,
                "uploaded_by": photo.uploaded_by,
                "created_at": photo.created_at.isoformat() if photo.created_at else "",
                "file_url": f"/api/v1/family/family-yard/photo/{photo.id}",  # 🔧 file_url 추가
                # "comments": []  # 🔧 댓글 기능 임시 제거
            })
        
        print(f"📅 날짜별 그룹화 결과: {list(photos_by_date.keys())}")
        return photos_by_date