import json
import asyncio
import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

# DB 세션을 직접 생성하기 위해 SessionLocal을 가져옵니다.
from app.services import ai_service, vector_db, conversation_service
from app.db.database import SessionLocal

print("🔥🔥🔥 SENIOR.PY 파일이 로드되었습니다! 🔥🔥🔥")

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    async def send_json(self, data: dict, user_id: str):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            await websocket.send_text(json.dumps(data, ensure_ascii=False))

manager = ConnectionManager()
session_conversations = {}

def _load_start_question():
    """프롬프트 파일을 로드하여 시작 질문을 반환합니다."""
    possible_paths = [
        # Docker 컨테이너 내부의 정확한 경로들
        '/backend/prompts/talk_prompts.json',  # 올바른 파일명
        './prompts/talk_prompts.json',
        # 상대 경로
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'prompts', 'talk_prompts.json'),
        # 혹시 모를 경우를 위한 백업 경로
        '/backend/prompts/talk_prompt.json',
    ]

    for path in possible_paths:
        try:
            print(f"🔍 프롬프트 파일 시도: {path}")
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                start_question = data.get('main_chat_prompt', {}).get('start_question', "안녕하세요!")
                print(f"✅ 프롬프트 파일 로드 성공: {path}")
                print(f"✅ 시작 질문: {start_question}")
                return start_question
        except FileNotFoundError:
            print(f"❌ 파일 없음: {path}")
            continue
        except Exception as e:
            print(f"❌ 파일 로드 실패 ({path}): {str(e)}")
            continue

    print("❌ 모든 경로에서 프롬프트 파일 로드 실패, 기본값 사용")
    return "안녕하세요! 오늘은 어떤 하루를 보내고 계신가요?"

# 🔥 핵심 수정사항: prefix가 없으므로 전체 경로 필요
@router.websocket("/senior/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    print(f"🔗 WebSocket 연결 요청 받음: {user_id}")

    try:
        await manager.connect(websocket, user_id)
        session_conversations[user_id] = []
        print(f"✅ 클라이언트 [{user_id}] 연결됨.")

        # 프롬프트 파일에서 시작 질문 로드
        start_question = _load_start_question()
        await manager.send_json({"type": "ai_message", "content": start_question}, user_id)
        session_conversations[user_id].append(f"AI: {start_question}")

        while True:
            audio_base64 = await websocket.receive_text()
            print(f"🎵 오디오 데이터 받음: {len(audio_base64)} bytes")

            # 🔧 실제 AI 서비스 호출로 복원
            try:
                user_message, ai_response = await ai_service.process_user_audio(user_id, audio_base64)

                if user_message:
                    await manager.send_json({"type": "user_message", "content": user_message}, user_id)
                    await manager.send_json({"type": "ai_message", "content": ai_response}, user_id)

                    session_conversations[user_id].append(f"사용자: {user_message}")
                    session_conversations[user_id].append(f"AI: {ai_response}")

                    # 🔧 DB 저장 다시 활성화
                    try:
                        db: Session = SessionLocal()
                        try:
                            user = conversation_service.get_or_create_user(db, user_id)
                            conversation_service.save_conversation(db, user, user_message, ai_response)
                            print(f"✅ DB 저장 완료: {user_id} - {user_message[:20]}...")
                        finally:
                            db.close()
                    except Exception as db_error:
                        print(f"❌ DB 저장 실패 (무시): {str(db_error)}")
                        # DB 오류가 있어도 대화는 계속 진행
                else:
                    await manager.send_json({"type": "ai_message", "content": ai_response}, user_id)

            except Exception as e:
                print(f"❌ AI 서비스 오류: {str(e)}")
                error_response = "죄송합니다. 잠시 문제가 있었어요. 다시 말씀해 주세요."
                await manager.send_json({"type": "ai_message", "content": error_response}, user_id)

    except WebSocketDisconnect:
        print(f"🔌 클라이언트 [{user_id}] 연결이 끊어졌습니다.")
    except Exception as e:
        print(f"❌ WebSocket 오류: {str(e)}")
        import traceback
        print(f"❌ 상세 오류: {traceback.format_exc()}")
    finally:
        if user_id in session_conversations:
            current_session_log = session_conversations.pop(user_id)
            try:
                await vector_db.create_memory_for_pinecone(user_id, current_session_log)
                print(f"✅ 벡터 DB 저장 완료: {user_id} - {len(current_session_log)}개 대화")
            except Exception as vector_error:
                print(f"❌ 벡터 DB 저장 실패 (무시): {str(vector_error)}")

        manager.disconnect(user_id)
        print(f"⏹️ [{user_id}] 클라이언트와의 모든 처리가 완료되었습니다.")