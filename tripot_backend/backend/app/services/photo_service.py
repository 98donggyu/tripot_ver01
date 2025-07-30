# app/services/photo_service.py

import os
import uuid
from datetime import datetime
from typing import List, Dict

from app.db import models

class PhotoService:
    """사진 파일 경로 생성, 데이터 그룹화 등 DB와 무관한 유틸리티를 담당합니다."""
    @staticmethod
    def generate_file_path(base_dir: str = "uploads/family_photos") -> tuple[str, str]:
        """날짜별 폴더 경로와 고유 파일명을 생성합니다."""
        today = datetime.now()
        date_folder = f"{today.year}/{today.month:02d}/{today.day:02d}"
        upload_path = os.path.join(base_dir, date_folder)
        os.makedirs(upload_path, exist_ok=True)
        unique_filename_base = f"{uuid.uuid4()}"
        return upload_path, unique_filename_base

    @staticmethod
    def group_photos_by_date(photos: List[models.FamilyPhoto]) -> Dict[str, List[Dict]]:
        """DB에서 조회한 사진 목록을 날짜별로 그룹화하여 API 응답 형태로 가공합니다."""
        photos_by_date = {}
        for photo in photos:
            date_key = photo.created_at.strftime('%Y-%m-%d')
            if date_key not in photos_by_date:
                photos_by_date[date_key] = []
            
            comments_data = [
                {
                    "id": c.id, "author_name": c.author_name, "comment_text": c.comment_text,
                    "created_at": c.created_at.isoformat()
                } for c in photo.comments
            ]
            photos_by_date[date_key].append({
                "id": photo.id, "uploaded_by": photo.uploaded_by,
                "created_at": photo.created_at.isoformat(),
                "file_url": f"/api/v1/family/family-yard/photo/{photo.id}",
                "comments": comments_data
            })
        return photos_by_date