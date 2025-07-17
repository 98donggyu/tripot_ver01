from sqlalchemy.orm import Session
from app.db import models

def get_or_create_user(db: Session, user_id_str: str) -> models.User:
    """
    사용자 ID 문자열로 사용자를 찾거나, 없으면 새로 생성하여 반환합니다.
    """
    # user_id_str을 기준으로 사용자를 찾습니다.
    user = db.query(models.User).filter(models.User.user_id_str == user_id_str).first()
    
    # 사용자가 없으면 새로 생성합니다.
    if not user:
        user = models.User(user_id_str=user_id_str)
        db.add(user)
        db.commit()
        db.refresh(user) # 생성된 사용자의 최신 정보(예: id)를 가져옵니다.
    return user

def save_conversation(db: Session, user: models.User, user_message: str, ai_message: str):
    """사용자와 AI의 대화 내용을 DB에 저장합니다."""
    
    # 사용자 대화 저장
    db_user_conv = models.Conversation(
        user_id=user.id,
        speaker='user',
        message=user_message
    )
    db.add(db_user_conv)

    # AI 대화 저장
    db_ai_conv = models.Conversation(
        user_id=user.id,
        speaker='ai',
        message=ai_message
    )
    db.add(db_ai_conv)
    
    # 변경사항을 데이터베이스에 최종 반영합니다.
    db.commit()
