import mysql.connector
import os
from datetime import date

def get_mysql_connection():
    """MySQL 직접 연결"""
    return mysql.connector.connect(
        host='db',  # Docker 내부에서는 'db' 사용
        user=os.getenv('MYSQL_USER'),
        password=os.getenv('MYSQL_PASSWORD'),
        database=os.getenv('MYSQL_DATABASE')
    )

def get_report_by_user_id(db, user_id_str: str):
    """
    사용자 ID로 최신 리포트 데이터를 조회하여 HomeScreen에 맞는 형태로 반환합니다.
    """
    try:
        print(f"✅ 리포트 서비스: {user_id_str}의 최신 데이터를 조회합니다.")
        
        # MySQL 직접 연결
        conn = get_mysql_connection()
        cursor = conn.cursor()
        
        # 🔧 가장 최신 summary 조회 (created_at 기준)
        query = """
        SELECT s.summary_json, s.report_date, s.created_at
        FROM summaries s
        JOIN users u ON s.user_id = u.id
        WHERE u.user_id_str = %s
        ORDER BY s.created_at DESC
        LIMIT 1
        """
        
        cursor.execute(query, (user_id_str,))
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if not result:
            print(f"❌ 요약 데이터를 찾을 수 없습니다: {user_id_str}")
            return _get_default_report_data()
        
        summary_json, report_date, created_at = result
        print(f"✅ 최신 요약 데이터 조회 성공 - 날짜: {report_date}, 생성시간: {created_at}")
        
        # JSON 파싱
        import json
        try:
            summary_data = json.loads(summary_json)
        except json.JSONDecodeError as e:
            print(f"❌ JSON 파싱 오류: {e}")
            return _get_default_report_data()
        
        # HomeScreen 형태로 변환
        return _transform_summary_to_homescreen(summary_data, report_date)
        
    except Exception as e:
        print(f"❌ 리포트 조회 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return _get_default_report_data()

def _transform_summary_to_homescreen(summary_data, report_date):
    """summary_json을 HomeScreen이 기대하는 형태로 변환"""
    try:
        print(f"🔄 리포트 데이터 변환 중... 날짜: {report_date}")
        
        # 기본값 설정
        name = "라기선님"
        mood = "보통"
        condition = "특별한 언급 없음"
        last_activity = "일상 생활"
        needs = "특별한 요청 없음"
        
        # 🔧 감정 상태 추출
        emotion_status = summary_data.get("감정_신체_상태", {})
        if emotion_status:
            emotion = emotion_status.get("전반적_감정", "")
            print(f"📊 감정 상태: {emotion}")
            
            if "긍정" in emotion or "좋" in emotion:
                mood = "좋음 😊"
            elif "부정" in emotion or "우울" in emotion or "슬픔" in emotion:
                mood = "우울함 😔"
            else:
                mood = "보통 😐"
            
            # 🔧 건강 상태
            health_mentions = emotion_status.get("건강_언급", [])
            if health_mentions and len(health_mentions) > 0:
                condition = ", ".join(health_mentions[:2])  # 최대 2개만
                print(f"🏥 건강 언급: {condition}")
        
        # 🔧 최근 활동 (일일 대화 요약에서 추출)
        daily_summary = summary_data.get("일일_대화_요약", {})
        if daily_summary:
            summary_text = daily_summary.get("요약", "")
            keywords = daily_summary.get("강조 키워드", [])
            
            if summary_text:
                # 요약에서 주요 활동 추출 (첫 문장)
                first_sentence = summary_text.split('.')[0]
                if len(first_sentence) > 0:
                    last_activity = first_sentence[:30] + "..."
                    print(f"📝 최근 활동: {last_activity}")
            elif keywords and len(keywords) > 0:
                last_activity = f"{keywords[0]} 관련 대화"
        
        # 🔧 요청 물품 추출
        requested_items = summary_data.get("요청_물품", [])
        if requested_items and len(requested_items) > 0:
            item = requested_items[0].get("물품", "")
            if item:
                needs = item
                print(f"🛒 요청 물품: {needs}")
        
        # 기본 통계 (고정값 - 나중에 실제 데이터로 교체 가능)
        contact_count = 12
        visit_count = 1
        question_count = 3
        
        # 랭킹 데이터 (고정값)
        ranking_data = [
            {"name": "첫째 아들", "score": 120},
            {"name": "막내 딸", "score": 95},
            {"name": "둘째 아들", "score": 80}
        ]
        
        result = {
            "name": name,
            "report_date": str(report_date),  # 리포트 날짜 추가
            "status": {
                "mood": mood,
                "condition": condition,
                "last_activity": last_activity,
                "needs": needs
            },
            "stats": {
                "contact": contact_count,
                "visit": visit_count,
                "question_answered": question_count
            },
            "ranking": ranking_data
        }
        
        print(f"✅ HomeScreen 데이터 변환 완료")
        return result
        
    except Exception as e:
        print(f"❌ 데이터 변환 중 오류: {str(e)}")
        import traceback
        traceback.print_exc()
        return _get_default_report_data()

def _get_default_report_data():
    """데이터가 없을 때 반환할 기본 리포트 데이터"""
    return {
        "name": "라기선님",
        "status": {
            "mood": "데이터 없음",
            "condition": "정보 없음", 
            "last_activity": "정보 없음",
            "needs": "정보 없음"
        },
        "stats": {
            "contact": 0,
            "visit": 0,
            "question_answered": 0
        },
        "ranking": [
            {"name": "데이터 없음", "score": 0}
        ]
    }