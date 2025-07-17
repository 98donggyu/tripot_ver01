import mysql.connector
import json
import os
from datetime import date
from dotenv import load_dotenv
import openai

# .env 파일 로드
load_dotenv('../.env')

# MySQL 연결
def get_mysql_connection():
    # Docker 컨테이너 외부에서 실행 시 localhost:3307 포트 사용
    db_host = os.getenv('DB_HOST')
    if db_host == 'db':  # Docker 내부 호스트명이면 localhost로 변경
        db_host = 'localhost'
    
    return mysql.connector.connect(
        host=db_host,
        port=3307,  # docker-compose.yml에서 설정한 외부 포트
        user=os.getenv('MYSQL_USER'),
        password=os.getenv('MYSQL_PASSWORD'),
        database=os.getenv('MYSQL_DATABASE')
    )

# OpenAI 클라이언트 초기화
client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def get_today_conversations():
    """오늘 날짜의 user_1752303760586_8wi64r 사용자 대화만 가져오기"""
    conn = get_mysql_connection()
    cursor = conn.cursor()
    
    today = date.today()
    target_user_id = 'user_1752303760586_8wi64r'  # 고정 사용자 ID
    
    query = """
    SELECT c.speaker, c.message 
    FROM conversations c
    JOIN users u ON c.user_id = u.id
    WHERE u.user_id_str = %s AND DATE(c.created_at) = %s
    ORDER BY c.created_at
    """
    
    cursor.execute(query, (target_user_id, today))
    results = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return results, target_user_id

def format_conversation_text(conversations):
    """대화를 텍스트로 포맷"""
    conversation_lines = []
    
    for speaker, message in conversations:
        speaker_name = "사용자" if speaker == "user" else "AI"
        conversation_lines.append(f"{speaker_name}: {message}")
    
    return "\n".join(conversation_lines)

def load_report_prompt():
    """report_prompts.json 파일 로드"""
    try:
        # 여러 경로 시도
        possible_paths = [
            '../prompts/report_prompts.json',
            './prompts/report_prompts.json', 
            '../backend/prompts/report_prompts.json'
        ]
        
        for path in possible_paths:
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    print(f"✅ 프롬프트 파일 로드 성공: {path}")
                    # report_analysis_prompt 키에서 데이터 추출
                    return data.get('report_analysis_prompt')
            except FileNotFoundError:
                print(f"❌ 파일 없음: {path}")
                continue
        
        print("❌ 모든 경로에서 프롬프트 파일을 찾을 수 없음")
        return None
        
    except Exception as e:
        print(f"❌ 프롬프트 파일 로드 실패: {e}")
        return None

def generate_ai_report(conversation_text, prompt_data):
    """OpenAI로 리포트 생성 - 올바른 프롬프트 구조 사용"""
    try:
        if not prompt_data:
            print("❌ 프롬프트 데이터가 없습니다.")
            return None
        
        # report_prompts.json 구조에 맞게 시스템 프롬프트 구성
        persona = prompt_data.get('persona', '')
        instructions = prompt_data.get('instructions', [])
        output_format = prompt_data.get('OUTPUT_FORMAT', {})
        
        # 시스템 프롬프트 조합
        system_prompt = f"""{persona}

### 분석 지침:
{chr(10).join(instructions)}

### 출력 형식:
다음 JSON 형식으로만 출력하세요. 추가 설명이나 인사말 등은 절대 포함하지 마세요.

{json.dumps(output_format, ensure_ascii=False, indent=2)}"""

        user_prompt = f"다음 대화를 분석해서 위 형식에 맞는 JSON 리포트를 생성해주세요:\n\n{conversation_text}"
        
        print("🤖 OpenAI API 호출 중...")
        response = client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=2000,
            temperature=0.3
        )
        
        result = json.loads(response.choices[0].message.content)
        
        # 리포트 날짜와 어르신 ID 추가
        result["리포트_날짜"] = date.today().strftime('%Y-%m-%d')
        result["어르신_ID"] = "user_1752303760586_8wi64r"
        
        print("✅ AI 리포트 생성 완료")
        return result
        
    except Exception as e:
        print(f"❌ AI 리포트 생성 실패: {e}")
        import traceback
        traceback.print_exc()
        return None

def save_to_summaries(user_id_str, report_data):
    """summaries 테이블에 저장"""
    conn = get_mysql_connection()
    cursor = conn.cursor()
    
    try:
        today = date.today()
        
        # 사용자 ID 찾기
        cursor.execute("SELECT id FROM users WHERE user_id_str = %s", (user_id_str,))
        user_result = cursor.fetchone()
        
        if not user_result:
            print(f"❌ 사용자를 찾을 수 없음: {user_id_str}")
            return False
        
        user_id = user_result[0]
        
        # 기존 요약 확인
        cursor.execute(
            "SELECT id FROM summaries WHERE user_id = %s AND report_date = %s",
            (user_id, today)
        )
        existing = cursor.fetchone()
        
        if existing:
            # 업데이트
            cursor.execute(
                "UPDATE summaries SET summary_json = %s WHERE id = %s",
                (json.dumps(report_data, ensure_ascii=False), existing[0])
            )
            print(f"✅ 기존 요약 업데이트: {user_id_str}")
        else:
            # 새로 생성
            cursor.execute(
                "INSERT INTO summaries (user_id, report_date, summary_json) VALUES (%s, %s, %s)",
                (user_id, today, json.dumps(report_data, ensure_ascii=False))
            )
            print(f"✅ 새 요약 생성: {user_id_str}")
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"❌ DB 저장 실패: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

def main():
    print(f"--- {date.today()} user_1752303760586_8wi64r 리포트 생성 시작 ---")
    
    # 1. 특정 사용자의 오늘 대화 가져오기
    conversations, user_id = get_today_conversations()
    if not conversations:
        print("❌ 오늘 대화가 없습니다.")
        return
    
    print(f"📊 {len(conversations)}개의 대화 발견")
    
    # 2. 대화 텍스트 포맷
    conversation_text = format_conversation_text(conversations)
    print(f"📝 대화 텍스트 길이: {len(conversation_text)} 문자")
    
    # 3. 프롬프트 로드
    prompt_data = load_report_prompt()
    if not prompt_data:
        print("❌ 프롬프트 로드 실패로 종료")
        return
    
    # 4. AI 리포트 생성
    print(f"\n🔄 {user_id} 리포트 생성 중...")
    report = generate_ai_report(conversation_text, prompt_data)
    
    if report:
        # 5. DB에 저장
        if save_to_summaries(user_id, report):
            print(f"\n🎉 리포트 생성 및 저장 완료!")
            
            # 6. 핵심 정보 미리보기 (HomeScreen용)
            print(f"\n--- 가족 앱용 핵심 정보 ---")
            print(f"📅 리포트 날짜: {report.get('리포트_날짜', 'N/A')}")
            
            # 요청 물품
            items = report.get('요청_물품', [])
            if items:
                print(f"🛒 요청 물품: {[item.get('물품', 'N/A') for item in items]}")
            else:
                print(f"🛒 요청 물품: 없음")
            
            # 건강 및 인지 상태
            emotion_status = report.get('감정_신체_상태', {})
            if emotion_status:
                emotion = emotion_status.get('전반적_감정', 'N/A')
                health_mentions = emotion_status.get('건강_언급', [])
                print(f"😊 전반적 감정: {emotion}")
                if health_mentions:
                    print(f"🏥 건강 언급: {health_mentions}")
                else:
                    print(f"🏥 건강 언급: 없음")
        else:
            print(f"❌ 리포트 저장 실패")
    else:
        print(f"❌ 리포트 생성 실패")
    
    print(f"\n✅ 처리 완료!")

if __name__ == "__main__":
    main()