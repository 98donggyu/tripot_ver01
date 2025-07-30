# app/api/v1/endpoints/auth.py (사용자 생성 예시 추가)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import crud
from app.db.database import get_db

router = APIRouter()

@router.post("/register")
def register_user(user_id_str: str, name: str, db: Session = Depends(get_db)):
    """새로운 사용자를 등록합니다."""
    db_user = crud.get_user_by_user_id_str(db, user_id_str)
    if db_user:
        raise HTTPException(status_code=400, detail="이미 등록된 사용자 ID입니다.")
    return crud.create_user(db=db, user_id_str=user_id_str, name=name)