# app/db/report_utils.py
# 리포트 생성을 위한 별도 유틸리티 함수들

from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
import json

def get_all_user_ids_for_today():
    """오늘 대화한 모든 사용자 ID를 반환합니다."""
    # 동적 import로 순환 참조 문제 해결
    from .database import SessionLocal
    from .models import User, Conversation
    
    db: Session = SessionLocal()
    try:
        today = date.today()
        print(f"🔍 {today} 날짜의 대화 사용자를 찾는 중...")
        
        # 오늘 날짜에 대화한 사용자들의 ID를 가져옵니다
        user_ids = db.query(User.user_id_str).join(Conversation).filter(
            func.date(Conversation.created_at) == today
        ).distinct().all()
        
        # 튜플에서 문자열로 변환
        result = [user_id[0] for user_id in user_ids]
        print(f"✅ 오늘 대화한 사용자 {len(result)}명 발견: {result}")
        return result
    except Exception as e:
        print(f"❌ 사용자 조회 오류: {e}")
        import traceback
        traceback.print_exc()
        return []
    finally:
        db.close()

def fetch_daily_conversations(user_id_str: str, target_date: date):
    """특정 날짜의 사용자 대화를 가져옵니다."""
    # 동적 import로 순환 참조 문제 해결
    from .database import SessionLocal
    from .models import User, Conversation
    
    db: Session = SessionLocal()
    try:
        print(f"🔍 {user_id_str} 사용자의 {target_date} 대화를 조회 중...")
        
        # 사용자 찾기
        user = db.query(User).filter(User.user_id_str == user_id_str).first()
        if not user:
            print(f"❌ 사용자를 찾을 수 없음: {user_id_str}")
            return None
        
        # 해당 날짜의 대화 가져오기
        conversations = db.query(Conversation).filter(
            Conversation.user_id == user.id,
            func.date(Conversation.created_at) == target_date
        ).order_by(Conversation.created_at).all()
        
        if not conversations:
            print(f"❌ {target_date} 날짜의 대화가 없음")
            return None
        
        print(f"✅ {len(conversations)}개의 대화 발견")
        
        # 대화 내용을 문자열로 조합
        conversation_text = ""
        for conv in conversations:
            speaker = "사용자" if conv.speaker == "user" else "AI"
            conversation_text += f"{speaker}: {conv.message}\n"
        
        return conversation_text.strip()
    except Exception as e:
        print(f"❌ 대화 조회 오류: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        db.close()

def save_summary_to_db(user_id_str: str, target_date: date, summary_data: dict):
    """요약 데이터를 DB에 저장합니다."""
    # 동적 import로 순환 참조 문제 해결
    from .database import SessionLocal
    from .models import User, Summary
    
    db: Session = SessionLocal()
    try:
        print(f"💾 {user_id_str}의 {target_date} 요약을 DB에 저장 중...")
        
        # 사용자 찾기
        user = db.query(User).filter(User.user_id_str == user_id_str).first()
        if not user:
            print(f"❌ 사용자를 찾을 수 없습니다: {user_id_str}")
            return False
        
        # 기존 요약이 있는지 확인
        existing_summary = db.query(Summary).filter(
            Summary.user_id == user.id,
            Summary.report_date == target_date
        ).first()
        
        if existing_summary:
            # 기존 요약 업데이트
            existing_summary.summary_json = summary_data
            print(f"✅ 기존 요약 업데이트: {user_id_str} - {target_date}")
        else:
            # 새 요약 생성
            new_summary = Summary(
                user_id=user.id,
                report_date=target_date,
                summary_json=summary_data
            )
            db.add(new_summary)
            print(f"✅ 새 요약 생성: {user_id_str} - {target_date}")
        
        db.commit()
        return True
    except Exception as e:
        print(f"❌ DB 저장 오류: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()