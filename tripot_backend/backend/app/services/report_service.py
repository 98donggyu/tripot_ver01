# app/services/report_service.py

from sqlalchemy.orm import Session
from datetime import date, timedelta
import json
import pandas as pd

from app.db import crud

# --- Public Functions ---

def get_home_screen_report(db: Session, user_id_str: str) -> dict:
    """
    사용자 ID로 최신 리포트를 조회하여 HomeScreen에 맞는 간략한 형태로 반환합니다.
    """
    latest_summary = crud.get_latest_summary(db, user_id_str)
    
    if not latest_summary or not latest_summary.summary_json:
        print(f"❌ 홈스크린 요약 데이터를 찾을 수 없습니다: {user_id_str}")
        return _get_default_home_summary_data()
        
    summary_data = latest_summary.summary_json
    report_date = latest_summary.report_date

    return _transform_summary_to_homescreen(summary_data, report_date)

def get_full_report(db: Session, user_id_str: str) -> dict:
    """
    최신 리포트와 인지 퀴즈 결과를 종합하여 ReportScreen에 맞는 상세 형태로 반환합니다.
    """
    # 1. 최신 대화 요약 리포트 가져오기
    latest_summary = crud.get_latest_summary(db, user_id_str)
    
    summary_data = {}
    report_date = date.today() # 기본값

    if not latest_summary or not latest_summary.summary_json:
        print(f"❌ 상세 리포트의 대화 요약 데이터를 찾을 수 없습니다: {user_id_str}")
        summary_data = _get_default_full_report_data() # 대화 요약 부분만 기본값으로 채움
    else:
        summary_data = latest_summary.summary_json
        report_date = latest_summary.report_date

    # 2. '오늘의 질문' 내용 가져오기
    daily_qa = crud.get_daily_question(db, report_date)
    if daily_qa:
        # summary_data에 '오늘의 질문/답변' 필드 추가 또는 업데이트
        if "일일_대화_요약" not in summary_data: summary_data["일일_대화_요약"] = {}
        if "매일_묻는_질문_응답" not in summary_data["일일_대화_요약"]: summary_data["일일_대화_요약"]["매일_묻는_질문_응답"] = {}
        
        summary_data["일일_대화_요약"]["매일_묻는_질문_응답"]["오늘_질문"] = daily_qa.question_text
        summary_data["일일_대화_요약"]["매일_묻는_질문_응답"]["오늘_답변"] = daily_qa.elderly_answer_content or "답변 없음"

    # 3. 최근 7일간의 인지 퀴즈 결과 데이터 가져오고 가공하기
    cognitive_data = _process_cognitive_data(db, user_id_str, days_back=7)
    
    # 4. 최종 리포트 조립
    summary_data["리포트_날짜"] = str(report_date)
    summary_data["인지상태_평가"] = cognitive_data
    
    return summary_data

# --- Helper Functions (Private) ---

def _process_cognitive_data(db: Session, user_id_str: str, days_back: int) -> dict:
    """DB에서 퀴즈 결과를 가져와 통계를 계산하고 가공합니다."""
    end_date = date.today()
    start_date = end_date - timedelta(days=days_back)
    
    # crud를 통해 퀴즈 결과와 주제를 함께 가져옴
    results = crud.fetch_quiz_results_with_topic(db, user_id_str, start_date, end_date)
    
    if not results:
        return _get_default_cognitive_report_data()

    df_results = pd.DataFrame(results, columns=['is_correct', 'topic'])
    
    total_quizzes_count = len(df_results)
    total_correct_count = int(df_results['is_correct'].sum())

    topic_summary_list = []
    if not df_results.empty:
        topic_grouped = df_results.groupby('topic').agg(
            total_for_topic=('is_correct', 'size'),
            correct_for_topic=('is_correct', 'sum')
        ).reset_index()
        
        topic_grouped['incorrect_for_topic'] = topic_grouped['total_for_topic'] - topic_grouped['correct_for_topic']
        
        # topic, total, incorrect 키를 가진 딕셔너리 리스트로 변환
        topic_summary_list = topic_grouped[['topic', 'total_for_topic', 'incorrect_for_topic']].rename(
            columns={'total_for_topic': 'total', 'incorrect_for_topic': 'incorrect'}
        ).to_dict(orient='records')

    return {
        "total_quizzes_count": total_quizzes_count,
        "total_correct_count": total_correct_count,
        "topic_summary": topic_summary_list
    }

def _transform_summary_to_homescreen(summary_data: dict, report_date: date) -> dict:
    """AI가 생성한 summary_json을 HomeScreen이 필요로 하는 형태로 변환합니다."""
    # (이전 코드의 _transform_summary_to_homescreen 함수 내용과 거의 동일)
    try:
        emotion_status = summary_data.get("감정_신체_상태", {})
        daily_summary = summary_data.get("일일_대화_요약", {})
        requested_items = summary_data.get("요청_물품", [])
        
        mood = emotion_status.get("전반적_감정", "보통 😐")
        condition = ", ".join(emotion_status.get("건강_언급", ["특별한 언급 없음"]))
        last_activity = daily_summary.get("요약", "일상 대화")
        needs = requested_items[0].get("물품", "특별한 요청 없음") if requested_items else "특별한 요청 없음"

        return {
            "name": summary_data.get("어르신_ID", "어르신"),
            "report_date": str(report_date),
            "status": { "mood": mood, "condition": condition, "last_activity": last_activity, "needs": needs },
            # stats와 ranking은 현재 DB에 없어 임시 고정값 사용
            "stats": { "contact": 12, "visit": 1, "Youtubeed": 3 },
            "ranking": [
                {"name": "첫째 아들", "score": 120},
                {"name": "막내 딸", "score": 95},
                {"name": "둘째 아들", "score": 80}
            ]
        }
    except Exception as e:
        print(f"❌ 홈스크린 데이터 변환 중 오류: {e}")
        return _get_default_home_summary_data()

# --- Default Data Functions (Private) ---

def _get_default_home_summary_data() -> dict:
    """데이터가 없을 때 반환할 HomeScreen용 기본 리포트"""
    # (이전 코드의 _get_default_report_data 함수 내용과 동일)
    return {
        "name": "어르신", "report_date": str(date.today()),
        "status": {"mood": "정보 없음", "condition": "정보 없음", "last_activity": "정보 없음", "needs": "정보 없음"},
        "stats": {"contact": 0, "visit": 0, "Youtubeed": 0},
        "ranking": []
    }

def _get_default_full_report_data() -> dict:
    """데이터가 없을 때 반환할 전체 리포트용 기본 구조"""
    return {
        "어르신_ID": "정보 없음", "요청_물품": [], "리포트_날짜": str(date.today()),
        "키워드_분석": [], "감정_신체_상태": {"건강_언급": [], "전반적_감정": "정보 없음"},
        "식사_상태_추정": [], "일일_대화_요약": {"요약": "대화 요약 정보가 없습니다.", "강조_키워드": []},
        "자녀를_위한_추천_대화_주제": []
    }

def _get_default_cognitive_report_data() -> dict:
    """인지 퀴즈 결과가 없을 때 반환할 기본 구조"""
    return { "total_quizzes_count": 0, "total_correct_count": 0, "topic_summary": [] }