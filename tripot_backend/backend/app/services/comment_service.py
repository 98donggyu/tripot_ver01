from sqlalchemy.orm import Session
from app.db import models
from fastapi import HTTPException

class CommentService:
    @staticmethod
    def create_comment(db: Session, photo_id: int, user_id: int, author_name: str, comment_text: str) -> models.PhotoComment:
        """
        데이터베이스에 새로운 댓글을 생성하고 저장합니다.
        """
        # 사진 존재 여부 확인
        db_photo = db.query(models.FamilyPhoto).filter(models.FamilyPhoto.id == photo_id).first()
        if not db_photo:
            raise HTTPException(status_code=404, detail="댓글을 달 사진을 찾을 수 없습니다.")

        db_comment = models.PhotoComment(
            photo_id=photo_id,
            user_id=user_id,
            author_name=author_name,
            comment_text=comment_text
        )
        db.add(db_comment)
        db.commit()
        db.refresh(db_comment)
        print(f"✅ 댓글 DB 저장 완료: comment_id={db_comment.id} on photo_id={photo_id}")
        return db_comment

    @staticmethod
    def get_comments_by_photo_id(db: Session, photo_id: int) -> list[models.PhotoComment]:
        """
        특정 사진에 달린 모든 댓글을 조회합니다.
        """
        # 사진 존재 여부 확인
        db_photo = db.query(models.FamilyPhoto).filter(models.FamilyPhoto.id == photo_id).first()
        if not db_photo:
            raise HTTPException(status_code=404, detail="사진을 찾을 수 없습니다.")
        
        comments = db.query(models.PhotoComment).filter(models.PhotoComment.photo_id == photo_id).order_by(models.PhotoComment.created_at.asc()).all()
        print(f"✅ photo_id={photo_id}의 댓글 {len(comments)}개 조회 완료")
        return comments