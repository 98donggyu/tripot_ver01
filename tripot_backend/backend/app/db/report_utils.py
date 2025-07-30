# app/db/report_utils.py 파일을 아래 내용으로 전체 교체하세요.

from datetime import date, timedelta
from app import crud
from app.database import SessionLocal

def get_all_user_ids_for_yesterday() -> list[str]:
    """
    어제 대화한 모든 사용자 ID를 반환합니다.
    (리포트 생성 스크립트용)
    """
    db = SessionLocal()
    try:
        # 오늘 날짜에서 하루를 빼서 어제 날짜를 계산
        yesterday = date.today() - timedelta(days=1)
        print(f"🔍 {yesterday} 날짜의 대화 사용자를 crud를 통해 찾는 중...")
        # crud 함수 호출 시, target_date를 'yesterday'로 명시
        return crud.get_user_ids_with_convos_on_date(db, target_date=yesterday)
    finally:
        db.close()

def fetch_daily_conversations(user_id_str: str, target_date: date) -> str | None:
    """특정 날짜의 사용자 대화를 가져옵니다."""
    db = SessionLocal()
    try:
        print(f"🔍 {user_id_str} 사용자의 {target_date} 대화를 crud를 통해 조회 중...")
        return crud.fetch_conversations_text_by_date(db, user_id=user_id_str, target_date=target_date)
    finally:
        db.close()

def save_summary_to_db(user_id_str: str, target_date: date, summary_data: dict) -> bool:
    """요약 데이터를 DB에 저장합니다."""
    db = SessionLocal()
    try:
        print(f"💾 {user_id_str}의 {target_date} 요약을 crud를 통해 DB에 저장 중...")
        crud.save_summary(db, user_id=user_id_str, report_date=target_date, summary_json=summary_data)
        return True
    except Exception as e:
        print(f"❌ DB 저장 오류: {e}")
        return False
    finally:
        db.close()