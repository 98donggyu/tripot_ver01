# app/api/v1/endpoints/daily_qa.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date

from app.db.database import get_db
from app.db import crud

router = APIRouter()

# --- Pydantic 스키마 ---
class DailyQuestionResponse(BaseModel):
    id: int
    daily_date: date
    question_text: str

class FamilyAnswerRequest(BaseModel):
    answer_text: str

# --- 엔드포인트 ---

@router.get("/", response_model=DailyQuestionResponse)
def get_today_daily_question(db: Session = Depends(get_db)):
    """오늘 날짜의 '오늘의 질문'을 가져옵니다."""
    today = date.today()
    question = crud.get_daily_question(db, target_date=today)
    if not question:
        raise HTTPException(status_code=404, detail="오늘의 질문을 찾을 수 없습니다.")
    return question

@router.post("/family-answer")
def post_family_answer(request: FamilyAnswerRequest, db: Session = Depends(get_db)):
    """오늘 질문에 대한 가족의 답변을 추가합니다."""
    today = date.today()
    question = crud.get_daily_question(db, target_date=today)
    if not question:
        raise HTTPException(status_code=404, detail="오늘의 질문이 없어 답변을 등록할 수 없습니다.")
    
    crud.add_family_answer_to_daily_question(db, target_date=today, answer_text=request.answer_text)
    return {"status": "success", "message": "가족 답변이 성공적으로 등록되었습니다."}
