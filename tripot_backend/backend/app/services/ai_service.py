import openai  # 오타 수정
import asyncio
import json
import os
import base64
import tempfile

from app.core.config import settings
# 순환 참조(Circular Dependency)를 피하기 위해, 이 파일에서는 다른 서비스 파일을 직접 import하지 않습니다.

# OpenAI 클라이언트 초기화
client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

# --- 1. Core AI Utilities (기존과 유사) ---

async def get_embedding(text: str) -> list[float]:
    """텍스트를 받아 임베딩 벡터를 반환합니다."""
    response = await asyncio.to_thread(
        client.embeddings.create, input=text, model="text-embedding-3-small"
    )
    return response.data[0].embedding

async def get_transcript_from_audio(audio_file_path: str) -> str:
    """오디오 파일 경로를 받아 STT(Speech-to-Text) 결과를 반환합니다."""
    with open(audio_file_path, "rb") as audio_file:
        transcript_response = await asyncio.to_thread(
            client.audio.transcriptions.create, model="whisper-1", file=audio_file, language="ko"
        )
    return transcript_response.text

async def get_ai_chat_completion(prompt: str, model: str = "gpt-4o", max_tokens: int = 150, temperature: float = 0.7) -> str:
    """주어진 프롬프트에 대한 AI 챗봇의 응답을 반환합니다."""
    messages = [
        {"role": "system", "content": "당신은 주어진 규칙과 페르소나를 완벽하게 따르는 AI 어시스턴트입니다."},
        {"role": "user", "content": prompt}
    ]
    chat_response = await asyncio.to_thread(
        client.chat.completions.create,
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature
    )
    return chat_response.choices[0].message.content

# --- 2. Main Real-time Conversation Logic (핵심 로직 이동) ---

def _load_talk_prompt():
    """prompts/talk_prompts.json 파일을 안전하게 읽어오는 헬퍼 함수"""
    # 🔧 파일명 수정: talk_prompts.json (s 추가)
    possible_paths = [
        '/backend/prompts/talk_prompts.json',
        os.path.join(os.path.dirname(__file__), '..', '..', 'prompts', 'talk_prompts.json'),
        './prompts/talk_prompts.json'
    ]
    
    for path in possible_paths:
        try:
            print(f"🔍 AI 서비스에서 프롬프트 파일 시도: {path}")
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)['main_chat_prompt']
                print(f"✅ AI 서비스 프롬프트 로드 성공: {path}")
                return data
        except Exception as e:
            print(f"❌ AI 서비스 프롬프트 로드 실패 ({path}): {e}")
            continue
    
    print("❌ AI 서비스에서 모든 경로 실패, None 반환")
    return None

PROMPTS_CONFIG = _load_talk_prompt()

async def process_user_audio(user_id: str, audio_base64: str):
    """
    사용자의 음성 데이터를 받아 처리하고, AI의 최종 응답을 생성하는 전체 과정을 담당합니다.
    (기존 main.py의 process_audio_and_get_response 로직을 이곳으로 이동)
    """
    try:
        print(f"🎵 AI 서비스 시작: {user_id}")
        print(f"🎵 받은 오디오 크기: {len(audio_base64)} bytes")
        
        # 🔧 vector_db 임포트를 try-catch로 안전하게 처리
        try:
            from . import vector_db_service as vector_db
            print("✅ vector_db 임포트 성공")
        except ImportError:
            print("❌ vector_db 임포트 실패, 기억 검색 없이 진행")
            vector_db = None

        # 🔧 오디오 파일 처리
        audio_data = base64.b64decode(audio_base64)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
            temp_audio.write(audio_data)
            temp_audio_path = temp_audio.name
        
        try:
            # 🔧 음성 인식 시도
            try:
                user_message = await get_transcript_from_audio(temp_audio_path)
                print(f"✅ 음성 인식 결과: {user_message}")
            except Exception as e:
                print(f"❌ 음성 인식 실패: {str(e)}")
                # 음성 인식 실패 시 임시 메시지 사용
                user_message = "안녕하세요"
            
            if not user_message.strip() or "시청해주셔서 감사합니다" in user_message:
                return None, "음, 잘 알아듣지 못했어요. 혹시 다시 한번 말씀해주시겠어요?"
            
            # 🔧 벡터 DB 기억 검색 (안전하게 처리)
            relevant_memories = ""
            if vector_db:
                try:
                    relevant_memories = await vector_db.search_memories(user_id, user_message)
                    print(f"✅ 기억 검색 완료")
                except Exception as e:
                    print(f"❌ 기억 검색 실패 (무시): {str(e)}")
                    relevant_memories = ""
            
            # 🔧 프롬프트 구성
            if not PROMPTS_CONFIG:
                print("❌ 프롬프트 설정 없음, 기본 응답 사용")
                return user_message, "대화 프롬프트 설정 파일을 불러올 수 없어 기본 응답을 드립니다."

            system_message = "\n".join(PROMPTS_CONFIG['system_message_base'])
            examples_text = "\n\n".join([f"상황: {ex['situation']}\n사용자 입력: {ex['user_input']}\nAI 응답: {ex['ai_response']}" for ex in PROMPTS_CONFIG['examples']])
            
            final_prompt = f"""# 페르소나\n{system_message}\n# 핵심 대화 규칙\n{"\n".join(PROMPTS_CONFIG['core_conversation_rules'])}\n# 응답 가이드라인\n{"\n".join(PROMPTS_CONFIG['guidelines_and_reactions'])}\n# 절대 금지사항\n{"\n".join(PROMPTS_CONFIG['strict_prohibitions'])}\n# 성공적인 대화 예시\n{examples_text}\n---\n이제 실제 대화를 시작합니다.\n--- 과거 대화 핵심 기억 ---\n{relevant_memories if relevant_memories else "이전 대화 기록이 없습니다."}\n--------------------\n현재 사용자 메시지: "{user_message}"\nAI 답변:"""
            
            # 🔧 AI 응답 생성
            try:
                ai_response = await get_ai_chat_completion(final_prompt)
                print(f"✅ AI 응답 생성 완료: {ai_response[:50]}...")
            except Exception as e:
                print(f"❌ AI 응답 생성 실패: {str(e)}")
                ai_response = "죄송합니다. 잠시 문제가 있었어요. 다시 말씀해 주세요."
            
            return user_message, ai_response
            
        finally:
            # 임시 파일 정리
            try:
                os.unlink(temp_audio_path)
            except:
                pass
                
    except Exception as e:
        print(f"❌ AI 서비스 전체 오류: {str(e)}")
        import traceback
        print(f"❌ 상세 오류: {traceback.format_exc()}")
        return None, "죄송합니다. 음성 처리 중 문제가 발생했어요. 다시 말씀해 주세요."

# --- 3. Report Generation Logic (for background scripts) ---

def _get_report_prompt():
    """prompts/report_prompt.json 파일을 읽어오는 헬퍼 함수"""
    prompt_file_path = os.path.join(os.path.dirname(__file__), '..', '..', 'prompts', 'report_prompt.json')
    try:
        with open(prompt_file_path, 'r', encoding='utf-8') as f:
            return json.load(f).get("report_analysis_prompt")
    except Exception as e:
        print(f"❌ report_prompt.json 파일을 불러오는 데 실패했습니다: {e}")
        return None

def generate_summary_report(conversation_text: str) -> dict | None:
    """대화 내용을 분석하여 JSON 형식의 리포트를 생성합니다 (동기 방식)."""
    
    report_prompt_template = _get_report_prompt()
    if not conversation_text or not report_prompt_template:
        return None

    persona = report_prompt_template.get('persona', '당신은 전문 대화 분석 AI입니다.')
    instructions = "\n".join(report_prompt_template.get('instructions', []))
    output_format_example = json.dumps(report_prompt_template.get('OUTPUT_FORMAT', {}), ensure_ascii=False, indent=2)

    system_prompt = f"{persona}\n\n### 지시사항\n{instructions}\n\n### 출력 형식\n모든 결과는 아래와 같은 JSON 형식으로만 출력해야 합니다. 추가 설명이나 인사말 등 JSON 외의 텍스트는 절대 포함하지 마세요.\n{output_format_example}"
    user_prompt = f"### 분석할 대화 전문\n---\n{conversation_text}\n---"

    try:
        completion = client.chat.completions.create(
            model="gpt-4o", 
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        print(f"AI 리포트 생성 중 오류 발생: {e}")
        return None