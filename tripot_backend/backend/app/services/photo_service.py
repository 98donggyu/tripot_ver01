import os
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional
from sqlalchemy.orm import Session, joinedload
from app.db.models import FamilyPhoto, User, PhotoComment # ✨ PhotoComment 임포트

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
        current_time = datetime.now(timezone.utc)
        
        photo = FamilyPhoto(
            user_id=user.id, 
            filename=filename, 
            original_name=original_name,
            file_path=file_path, 
            file_size=file_size, 
            uploaded_by=uploaded_by,
            created_at=current_time
        )
        db.add(photo)
        db.commit()
        db.refresh(photo)
        
        print(f"✅ 사진 저장 완료 - ID: {photo.id}, created_at: {photo.created_at}")
        
        return photo

    @staticmethod
    def get_photos_by_user(db: Session, user: User, limit: int = 50) -> List[FamilyPhoto]:
        # ✨ 수정된 부분: joinedload를 사용하여 댓글을 함께 조회 (효율성 UP)
        photos = db.query(FamilyPhoto)\
                 .options(joinedload(FamilyPhoto.comments))\
                 .filter(FamilyPhoto.user_id == user.id)\
                 .order_by(FamilyPhoto.created_at.desc())\
                 .limit(limit)\
                 .all()
        
        print(f"📷 조회된 사진 개수: {len(photos)}")
        for photo in photos:
            print(f"  - ID: {photo.id}, created_at: {photo.created_at}, comments: {len(photo.comments)}개")
        
        return photos

    @staticmethod
    def get_photo_by_id(db: Session, photo_id: int) -> Optional[FamilyPhoto]:
        # ✨ 수정된 부분: 댓글 정보도 함께 가져오도록 joinedload 추가
        return db.query(FamilyPhoto)\
                 .options(joinedload(FamilyPhoto.comments))\
                 .filter(FamilyPhoto.id == photo_id)\
                 .first()

    @staticmethod
    def group_photos_by_date(photos: List[FamilyPhoto]) -> Dict[str, List[Dict]]:
        photos_by_date = {}
        
        for photo in photos:
            if photo.created_at is None:
                print(f"⚠️ 경고: photo.id={photo.id}의 created_at이 NULL입니다")
                date_key = datetime.now().strftime('%Y-%m-%d')
            else:
                date_key = photo.created_at.strftime('%Y-%m-%d')
            
            if date_key not in photos_by_date:
                photos_by_date[date_key] = []
            
            # ✨ 수정된 부분: photo 객체에 이미 로드된 댓글 정보를 응답에 포함
            comments_data = [
                {
                    "id": comment.id,
                    "author_name": comment.author_name,
                    "comment_text": comment.comment_text,
                    "created_at": comment.created_at.isoformat()
                } for comment in photo.comments
            ]

            photos_by_date[date_key].append({
                "id": photo.id,
                "uploaded_by": photo.uploaded_by,
                "created_at": photo.created_at.isoformat() if photo.created_at else "",
                "file_url": f"/api/v1/family/family-yard/photo/{photo.id}",
                "comments": comments_data # ✨ 주석 해제 및 데이터 추가
            })
        
        print(f"📅 날짜별 그룹화 결과: {list(photos_by_date.keys())}")
        return photos_by_date
