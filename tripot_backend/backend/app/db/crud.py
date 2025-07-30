# app/db/crud.py

from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta, time
import json
import pandas as pd

from . import models, database

# --- User CRUD ---

def get_user_by_user_id_str(db: Session, user_id_str: str) -> models.User | None:
    """user_id_str로 사용자를 조회합니다."""
    return db.query(models.User).filter(models.User.user_id_str == user_id_str).first()

def create_user(db: Session, user_id_str: str, name: str = None) -> models.User:
    """새로운 사용자를 생성합니다."""
    db_user = models.User(user_id_str=user_id_str, name=name)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_or_create_user(db: Session, user_id_str: str, name: str = None) -> models.User:
    """사용자가 없으면 생성하고, 있으면 반환합니다."""
    user = get_user_by_user_id_str(db, user_id_str)
    if not user:
        user = create_user(db, user_id_str, name)
    return user

# --- Conversation & Summary CRUD ---

def save_conversation(db: Session, user_id_str: str, user_message: str, ai_message: str):
    """실시간 대화를 DB에 저장합니다."""
    user = get_or_create_user(db, user_id_str)
    user_convo = models.Conversation(user_id=user.id, speaker='user', message=user_message)
    ai_convo = models.Conversation(user_id=user.id, speaker='ai', message=ai_message)
    db.add(user_convo)
    db.add(ai_convo)
    db.commit()

def save_summary(db: Session, user_id_str: str, report_date: date, summary_json: dict):
    """분석된 리포트를 DB에 저장 또는 업데이트합니다."""
    user = get_or_create_user(db, user_id_str)
    existing = db.query(models.Summary).filter_by(user_id=user.id, report_date=report_date).first()
    if existing:
        existing.summary_json = summary_json
    else:
        new_summary = models.Summary(user_id=user.id, report_date=report_date, summary_json=summary_json)
        db.add(new_summary)
    db.commit()

def get_latest_summary(db: Session, user_id_str: str) -> models.Summary | None:
    """사용자 ID로 가장 최신 리포트를 가져옵니다."""
    user = get_user_by_user_id_str(db, user_id_str)
    if not user: return None
    return db.query(models.Summary).filter_by(user_id=user.id).order_by(models.Summary.report_date.desc()).first()

def get_user_ids_with_convos_on_date(db: Session, target_date: date) -> list[str]:
    """특정 날짜에 대화한 모든 사용자 ID 목록을 반환합니다."""
    user_ids = db.query(models.User.user_id_str).join(models.Conversation).filter(
        func.date(models.Conversation.created_at) == target_date
    ).distinct().all()
    return [uid[0] for uid in user_ids]

def fetch_conversations_text_by_date(db: Session, user_id_str: str, target_date: date) -> str:
    """특정 사용자의 하루치 대화 내용을 리포트용 텍스트로 조합하여 반환합니다."""
    conversations = db.query(models.Conversation).join(models.User).filter(
        models.User.user_id_str == user_id_str,
        func.date(models.Conversation.created_at) == target_date
    ).order_by(models.Conversation.created_at.asc()).all()
    if not conversations: return ""
    formatted = [f"{'사용자' if c.speaker == 'user' else 'AI'}: {c.message}" for c in conversations]
    return "\n".join(formatted)

# --- Photo & Comment CRUD ---

def create_photo(db: Session, user_id: int, filename: str, original_name: str, file_path: str, file_size: int, uploaded_by: str) -> models.FamilyPhoto:
    photo = models.FamilyPhoto(
        user_id=user_id, filename=filename, original_name=original_name,
        file_path=file_path, file_size=file_size, uploaded_by=uploaded_by
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo

def get_photos_by_user_id(db: Session, user_id: int, limit: int) -> list[models.FamilyPhoto]:
    return db.query(models.FamilyPhoto).filter(models.FamilyPhoto.user_id == user_id).order_by(models.FamilyPhoto.created_at.desc()).limit(limit).all()

def get_photo_by_id(db: Session, photo_id: int) -> models.FamilyPhoto | None:
    return db.query(models.FamilyPhoto).filter(models.FamilyPhoto.id == photo_id).first()

def create_comment(db: Session, photo_id: int, user_id: int, author_name: str, text: str) -> models.PhotoComment:
    comment = models.PhotoComment(photo_id=photo_id, user_id=user_id, author_name=author_name, comment_text=text)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment

def get_comments_by_photo_id(db: Session, photo_id: int) -> list[models.PhotoComment]:
    return db.query(models.PhotoComment).filter(models.PhotoComment.photo_id == photo_id).all()

# --- Schedule CRUD ---

def get_schedules_by_user_id_str(db: Session, user_id_str: str) -> list[models.ConversationSchedule]:
    user = get_user_by_user_id_str(db, user_id_str)
    if not user: return []
    return db.query(models.ConversationSchedule).filter_by(user_id=user.id).order_by(models.ConversationSchedule.call_time.asc()).all()

def set_schedules(db: Session, user_id_str: str, call_times: list[time], family_user_id_str: str = None):
    senior_user = get_or_create_user(db, user_id_str)
    family_user_id = None
    if family_user_id_str:
        family_user = get_user_by_user_id_str(db, family_user_id_str)
        if family_user: family_user_id = family_user.id

    db.query(models.ConversationSchedule).filter_by(user_id=senior_user.id).delete()
    
    for t in call_times:
        new_schedule = models.ConversationSchedule(
            user_id=senior_user.id, call_time=t,
            family_user_id=family_user_id, set_by="family" if family_user_id else "user"
        )
        db.add(new_schedule)

    senior_user.schedule_updated_at = datetime.utcnow()
    senior_user.schedule_updated_by = family_user_id_str or user_id_str
    db.commit()

def update_user_last_schedule_check(db: Session, user_id_str: str):
    user = get_user_by_user_id_str(db, user_id_str)
    if user:
        user.last_schedule_check = datetime.utcnow()
        db.commit()

def get_all_active_schedules(db: Session) -> list[tuple[str, str]]:
    schedules = db.query(
        models.User.user_id_str, models.ConversationSchedule.call_time
    ).join(
        models.User, models.ConversationSchedule.user_id == models.User.id
    ).filter(
        models.ConversationSchedule.is_enabled == True
    ).all()
    return [(user_id, call_time.strftime("%H:%M")) for user_id, call_time in schedules]

# --- Calendar CRUD ---

def update_calendar_data(db: Session, senior_user_id_str: str, family_user_id_str: str, calendar_json: str):
    user = get_user_by_user_id_str(db, senior_user_id_str)
    if user:
        user.calendar_data = calendar_json
        user.calendar_updated_at = datetime.utcnow()
        user.calendar_updated_by = family_user_id_str
        db.commit()

def update_user_last_calendar_check(db: Session, user_id_str: str):
    user = get_user_by_user_id_str(db, user_id_str)
    if user:
        user.last_calendar_check = datetime.utcnow()
        db.commit()

# --- Daily Question CRUD ---

def get_daily_question(db: Session, target_date: date) -> models.DailyQA | None:
    return db.query(models.DailyQA).filter(models.DailyQA.daily_date == target_date).first()

def add_family_answer_to_daily_question(db: Session, target_date: date, answer_text: str):
    question = get_daily_question(db, target_date)
    if question:
        current_answers = question.family_answer_content or ""
        new_answers = f"{current_answers}\n{answer_text}".strip()
        question.family_answer_content = new_answers
        db.commit()

def update_elderly_answer_log(db: Session, target_date: date, new_log_entry: str):
    question = get_daily_question(db, target_date)
    if question:
        current_log = question.elderly_answer_content or ""
        new_log = f"{current_log}\n{new_log_entry}".strip()
        question.elderly_answer_content = new_log
        db.commit()

# --- Quiz & Quiz Result CRUD ---

def save_quiz_result(db: Session, result_data: dict):
    """퀴즈 결과를 DB에 저장합니다."""
    user_id_str = result_data.get("user_id")
    user = get_or_create_user(db, user_id_str)
    
    db_result_data = result_data.copy()
    db_result_data['user_id'] = user.id
    
    new_result = models.QuizResult(**db_result_data)
    db.add(new_result)
    db.commit()

def fetch_quizzes_as_df() -> pd.DataFrame:
    """DB에서 모든 퀴즈를 불러와 DataFrame으로 반환합니다."""
    try:
        engine = database.engine
        query = "SELECT id, topic, question_text, answer FROM quiz"
        df = pd.read_sql(query, engine)
        return df
    except Exception as e:
        print(f"❌ 퀴즈 DB 데이터 로드 중 오류 발생: {e}")
        return pd.DataFrame()

def fetch_quiz_results_with_topic(db: Session, user_id_str: str, start_date: date, end_date: date) -> list:
    """기간 내 사용자의 퀴즈 결과와 주제를 함께 가져옵니다."""
    user = get_user_by_user_id_str(db, user_id_str)
    if not user: return []
    
    return db.query(
        models.QuizResult.is_correct,
        models.Quiz.topic
    ).join(
        models.Quiz, models.QuizResult.quiz_id == models.Quiz.id
    ).filter(
        models.QuizResult.user_id == user.id,
        func.date(models.QuizResult.created_at).between(start_date, end_date)
    ).all()

def delete_schedules_by_user_id_str(db: Session, user_id_str: str) -> int:
    """사용자의 모든 스케줄을 삭제하고 삭제된 개수를 반환합니다."""
    user = get_user_by_user_id_str(db, user_id_str)
    if not user:
        return 0
    
    # 해당 사용자의 스케줄을 삭제하고, 삭제된 행의 수를 받아옵니다.
    deleted_count = db.query(models.ConversationSchedule).filter(models.ConversationSchedule.user_id == user.id).delete()
    
    # 사용자 정보에 스케줄이 업데이트되었다는 사실을 기록합니다.
    user.schedule_updated_at = datetime.utcnow()
    user.schedule_updated_by = user_id_str # 스스로 삭제했음을 기록
    db.commit()
    
    return deleted_count