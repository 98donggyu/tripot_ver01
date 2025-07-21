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

    @staticmethod
    def update_comment(db: Session, comment_id: int, user_id_str: str, new_comment_text: str) -> models.PhotoComment:
        """
        댓글을 수정합니다. 작성자만 수정 가능합니다.
        """
        # 댓글 존재 여부 확인
        db_comment = db.query(models.PhotoComment).filter(models.PhotoComment.id == comment_id).first()
        if not db_comment:
            raise HTTPException(status_code=404, detail="수정할 댓글을 찾을 수 없습니다.")
        
        # 작성자 확인 (user_id로 비교)
        user = db.query(models.User).filter(models.User.user_id_str == user_id_str).first()
        if not user or db_comment.user_id != user.id:
            raise HTTPException(status_code=403, detail="본인이 작성한 댓글만 수정할 수 있습니다.")
        
        # 댓글 내용 업데이트
        db_comment.comment_text = new_comment_text
        db.commit()
        db.refresh(db_comment)
        print(f"✅ 댓글 수정 완료: comment_id={comment_id}")
        return db_comment

    @staticmethod
    def delete_comment(db: Session, comment_id: int, user_id_str: str) -> bool:
        """
        댓글을 삭제합니다. 작성자만 삭제 가능합니다.
        """
        # 댓글 존재 여부 확인
        db_comment = db.query(models.PhotoComment).filter(models.PhotoComment.id == comment_id).first()
        if not db_comment:
            raise HTTPException(status_code=404, detail="삭제할 댓글을 찾을 수 없습니다.")
        
        # 작성자 확인
        user = db.query(models.User).filter(models.User.user_id_str == user_id_str).first()
        if not user or db_comment.user_id != user.id:
            raise HTTPException(status_code=403, detail="본인이 작성한 댓글만 삭제할 수 있습니다.")
        
        # 댓글 삭제
        db.delete(db_comment)
        db.commit()
        print(f"✅ 댓글 삭제 완료: comment_id={comment_id}")
        return True