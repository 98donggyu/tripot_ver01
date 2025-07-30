# app/services/ai_service.py

import openai
import asyncio
import json
import os
import base64
import tempfile
import traceback

from app.core.config import settings
from . import vector_db_service

# OpenAI 클라이언트 초기화
client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

# --- 1. Core AI Utilities ---

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

async def get_ai_chat_completion(
    prompt: str = None, 
    messages: list[dict] = None, 
    model: str = "gpt-4o", 
    max_tokens: int = 150, 
    temperature: float = 0.7
) -> str:
    """주어진 프롬프트나 메시지 리스트에 대한 AI 챗봇의 응답을 반환합니다."""
    if messages is None:
        if prompt is None:
            raise ValueError("prompt 또는 messages 중 하나는 반드시 제공되어야 합니다.")
        messages = [
            {"role": "system", "content": "당신은 주어진 규칙과 페르소나를 완벽하게 따르는 AI 어시스턴트입니다."},
            {"role": "user", "content": prompt}
        ]
    chat_response = await asyncio.to_thread(
        client.chat.completions.create,
        model=model, messages=messages, max_tokens=max_tokens, temperature=temperature
    )
    return chat_response.choices[0].message.content

# --- 2. Main Conversation Logic ---

def _load_prompt_config(filename: str, key: str):
    """settings에 정의된 경로에서 프롬프트 파일을 안전하게 읽어옵니다."""
    prompt_file_path = os.path.join(settings.PROMPTS_DIR, filename)
    try:
        with open(prompt_file_path, 'r', encoding='utf-8') as f:
            print(f"✅ 프롬프트 로드 성공: {prompt_file_path}")
            return json.load(f).get(key)
    except Exception as e:
        print(f"❌ 프롬프트 로드 실패 ({prompt_file_path}): {e}")
        return None

PROMPTS_CONFIG = _load_prompt_config('talk_prompts.json', 'main_chat_prompt')

async def process_user_audio(user_id: str, audio_base64: str) -> tuple[str | None, str]:
    """사용자의 음성 데이터를 처리하고 AI의 일반 대화 응답을 생성합니다."""
    try:
        audio_data = base64.b64decode(audio_base64)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
            temp_audio.write(audio_data)
            temp_audio_path = temp_audio.name

        try:
            user_message = await get_transcript_from_audio(temp_audio_path)
            if not user_message.strip() or "시청해주셔서 감사합니다" in user_message:
                return None, "음, 잘 알아듣지 못했어요. 혹시 다시 한번 말씀해주시겠어요?"

            relevant_memories = await vector_db_service.search_memories(user_id, user_message)

            if not PROMPTS_CONFIG:
                return user_message, "대화 프롬프트 설정 파일을 불러올 수 없습니다."

            system_message = "\n".join(PROMPTS_CONFIG['system_message_base'])
            examples_text = "\n\n".join([f"상황: {ex['situation']}\n사용자 입력: {ex['user_input']}\nAI 응답: {ex['ai_response']}" for ex in PROMPTS_CONFIG['examples']])
            
            final_prompt = f"""# 페르소나\n{system_message}\n# 핵심 대화 규칙\n{"\n".join(PROMPTS_CONFIG['core_conversation_rules'])}\n# 응답 가이드라인\n{"\n".join(PROMPTS_CONFIG['guidelines_and_reactions'])}\n# 절대 금지사항\n{"\n".join(PROMPTS_CONFIG['strict_prohibitions'])}\n# 성공적인 대화 예시\n{examples_text}\n---\n이제 실제 대화를 시작합니다.\n--- 과거 대화 핵심 기억 ---\n{relevant_memories if relevant_memories else "이전 대화 기록이 없습니다."}\n--------------------\n현재 사용자 메시지: "{user_message}"\nAI 답변:"""
            
            ai_response = await get_ai_chat_completion(prompt=final_prompt)
            return user_message, ai_response
        finally:
            os.unlink(temp_audio_path)
            
    except Exception as e:
        print(f"❌ AI 서비스 전체 오류: {str(e)}\n{traceback.format_exc()}")
        return None, "죄송합니다. 음성 처리 중 문제가 발생했어요."

# --- 3. Quiz & Command Logic ---

async def check_quiz_command(user_input_text: str) -> dict | None:
    """사용자 입력에서 '문제 시작/종료' 명령어를 감지합니다."""
    user_message_lower = user_input_text.lower()
    start_keywords = ["문제", "퀴즈"]
    action_keywords = ["풀래", "내줘", "시작", "줘봐"]
    stop_keywords = ["그만", "종료", "안할래"]

    if any(kw in user_message_lower for kw in start_keywords):
        if any(act in user_message_lower for act in action_keywords):
            return {"type": "command", "action": "start_quiz", "response_text": "네, 좋습니다! 그럼 지금부터 재미있는 문제를 시작해볼까요?"}
        if any(act in user_message_lower for act in stop_keywords):
            return {"type": "command", "action": "stop_quiz", "response_text": "네, 알겠습니다. 문제는 여기까지 할게요."}
    return None

async def get_quiz_feedback(question: str, user_answer: str, correct_answer: str) -> tuple[str, bool]:
    """LLM을 통해 퀴즈 답변을 채점하고 피드백을 생성합니다."""
    prompt_messages = [
        {"role": "system", "content": "당신은 어르신에게 문제 정답 여부를 판단하고 따뜻한 피드백을 제공하는 친절한 AI 말벗입니다. 사용자의 답변이 정답인지 아닌지 명확하게 판단하여 알려주세요. 추가 질문이나 대화 유도는 절대 하지 마세요. 정답이라면 칭찬과 함께 답변 마지막에 'TRUE'를, 오답이라면 정답을 알려주고 격려하며 'FALSE'를 반드시 포함해주세요. 예시: '정답이에요! 정말 잘하셨어요! TRUE', '아쉽지만 틀렸어요. 정답은 OO였답니다. FALSE'"},
        {"role": "user", "content": f"문제: {question}\n어르신 답변: {user_answer}\n정답: {correct_answer}"}
    ]
    try:
        raw_llm_response = await get_ai_chat_completion(messages=prompt_messages, max_tokens=100, temperature=0.5)
        is_correct = "TRUE" in raw_llm_response.upper()
        feedback_text = raw_llm_response.upper().replace("TRUE", "").replace("FALSE", "").strip()
        return feedback_text, is_correct
    except Exception as e:
        print(f"❌ LLM 퀴즈 피드백 생성 오류: {e}")
        if str(correct_answer).lower() in str(user_answer).lower():
            return "정답이에요! 정말 대단하세요!", True
        else:
            return f"아쉽지만 정답은 '{correct_answer}' 였어요. 다음 문제도 화이팅!", False

# --- 4. Report Generation Logic ---

def generate_summary_report(conversation_text: str) -> dict | None:
    """대화 내용을 분석하여 JSON 형식의 리포트를 생성합니다."""
    report_prompt_template = _load_prompt_config('report_prompts.json', 'report_analysis_prompt')
    if not conversation_text or not report_prompt_template:
        return None

    persona = report_prompt_template.get('persona', '당신은 전문 대화 분석 AI입니다.')
    instructions = "\n".join(report_prompt_template.get('instructions', []))
    output_format_example = json.dumps(report_prompt_template.get('OUTPUT_FORMAT', {}), ensure_ascii=False, indent=2)

    system_prompt = f"{persona}\n\n### 지시사항\n{instructions}\n\n### 출력 형식\n모든 결과는 아래와 같은 JSON 형식으로만 출력해야 합니다. JSON 외의 텍스트는 절대 포함하지 마세요.\n{output_format_example}"
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