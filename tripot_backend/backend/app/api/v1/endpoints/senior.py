# app/api/v1/endpoints/senior.py

import json
import os
import asyncio
import base64
import tempfile
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

# --- 통합된 모듈 임포트 ---
from app.services import ai_service, vector_db_service
from app.services.quiz_manager import QuizManager
from app.services.connection_manager import manager # 분리된 매니저 사용
from app.db import crud
from app.core.config import settings
from app.db.database import SessionLocal

router = APIRouter()

# --- 각 사용자 세션을 관리하는 딕셔너리 ---
# (퀴즈 관리자 인스턴스와 대화 로그를 포함)
user_sessions = {}

# --- 서버 시작 시 퀴즈 데이터와 프롬프트 경로 미리 준비 ---
ALL_QUIZZES_DF = crud.fetch_quizzes_as_df()
PROMPTS_FILE_PATH = os.path.join(settings.PROMPTS_DIR, 'quiz_prompts.json')

# --- 웹소켓 엔드포인트 ---

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    
    # --- 1. 사용자 세션 초기화 ---
    user_sessions[user_id] = {
        "quiz_manager": QuizManager(ALL_QUIZZES_DF, PROMPTS_FILE_PATH, ai_service),
        "conversation_log": []
    }
    print(f"✅ 클라이언트 [{user_id}] 연결됨. 세션 초기화 완료.")

    # --- 2. 시작 메시지 전송 ---
    # TODO: 시작 메시지를 talk_prompts.json에서 동적으로 불러오도록 개선
    start_question = "안녕하세요! 오늘은 어떤 재미있는 이야기를 나눠볼까요?"
    await manager.send_json({"type": "ai_message", "content": start_question}, user_id)
    
    # 세션 로그에 시작 메시지 기록
    user_sessions[user_id]["conversation_log"].append(f"AI: {start_question}")
    
    # DB 세션 생성
    db: Session = SessionLocal()
    try:
        # --- 3. 메시지 수신 및 처리 루프 ---
        while True:
            audio_base64 = await websocket.receive_text()
            
            # 3-1. STT (Speech-to-Text)
            user_message = await _audio_to_text(audio_base64)
            if not user_message:
                await manager.send_json({"type": "ai_message", "content": "음, 잘 못 들었어요. 다시 말씀해주시겠어요?"}, user_id)
                continue
            
            # 사용자 메시지 화면에 표시
            await manager.send_json({"type": "user_message", "content": user_message}, user_id)

            # 3-2. 비즈니스 로직 처리 (퀴즈/일반대화)
            quiz_manager = user_sessions[user_id]["quiz_manager"]
            response_text = ""

            if quiz_manager.is_active():
                # 퀴즈 진행 중일 때: 사용자 입력을 정답으로 간주
                response_text, result_to_save = await quiz_manager.process_answer(user_message)
                if result_to_save:
                    crud.save_quiz_result(db, result_to_save)
            else:
                # 일반 대화 상태일 때: 명령어 확인 후 처리
                command = await ai_service.check_quiz_command(user_message)
                if command:
                    if command["action"] == "start_quiz":
                        start_msg, first_question = quiz_manager.start_quiz(user_id)
                        response_text = f"{start_msg}\n{first_question}" if first_question else start_msg
                    elif command["action"] == "stop_quiz":
                        response_text = quiz_manager.stop_quiz()
                else:
                    # 일반 대화 처리
                    _, response_text = await ai_service.process_user_audio(user_id, audio_base64)
            
            # 3-3. 최종 응답 전송 및 저장 (통합된 부분)
            await manager.send_json({"type": "ai_message", "content": response_text}, user_id)
            
            # 모든 대화를 conversations 테이블에 저장
            crud.save_conversation(db, user_id, user_message, response_text)
            
            # 모든 대화를 Pinecone 요약용 세션 로그에 추가
            user_sessions[user_id]["conversation_log"].append(f"사용자: {user_message}")
            user_sessions[user_id]["conversation_log"].append(f"AI: {response_text}")

    except WebSocketDisconnect:
        print(f"🔌 클라이언트 [{user_id}] 연결이 끊어졌습니다.")
    except Exception as e:
        print(f"❌ WebSocket 처리 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # --- 4. 연결 종료 시 후처리 ---
        if user_id in user_sessions:
            session_log = user_sessions[user_id].get("conversation_log", [])
            if session_log:
                # 대화 기록을 Pinecone에 기억으로 저장
                await vector_db_service.create_memory_for_pinecone(user_id, session_log)
            del user_sessions[user_id]
        
        manager.disconnect(user_id)
        db.close()
        print(f"⏹️ [{user_id}] 클라이언트 세션 정리 완료.")

async def _audio_to_text(audio_base64: str) -> str | None:
    """오디오 데이터를 텍스트로 변환하는 헬퍼 함수"""
    temp_audio_path = None
    try:
        audio_data = base64.b64decode(audio_base64)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
            temp_audio.write(audio_data)
            temp_audio_path = temp_audio.name
        
        user_message = await ai_service.get_transcript_from_audio(temp_audio_path)
        
        if not user_message.strip() or "시청해주셔서 감사합니다" in user_message:
            return None
        return user_message
    except Exception as e:
        print(f"STT 처리 오류: {e}")
        return None
    finally:
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.unlink(temp_audio_path)