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
        '/backend/prompts/talk_prompts.json',
        './prompts/talk_prompts.json',
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'prompts', 'talk_prompts.json'),
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
            message = await websocket.receive_text()
            
            # ✨ 정시 대화 응답 처리
            if message.startswith('{"type":"scheduled_call_response"'):
                response_data = json.loads(message)
                action = response_data.get("action")
                
                if action == "start_now":
                    print(f"📞 {user_id} 정시 대화 즉시 시작")
                    scheduled_question = "안녕하세요! 정시 대화 시간이에요. 오늘 하루는 어떻게 보내셨나요?"
                    await manager.send_json({"type": "ai_message", "content": scheduled_question}, user_id)
                    session_conversations[user_id].append(f"AI: {scheduled_question}")
                elif action == "snooze":
                    print(f"⏰ {user_id} 대화 10분 연기")
                    # 10분 후 재알림 로직 (필요시 구현)
                    await manager.send_json({"type": "system_message", "content": "10분 후에 다시 알려드릴게요."}, user_id)
                elif action == "skip":
                    print(f"⏭️ {user_id} 오늘 대화 건너뛰기")
                    await manager.send_json({"type": "system_message", "content": "오늘은 대화를 건너뛰겠습니다. 내일 또 뵐게요!"}, user_id)
                continue
            
            # 기존 오디오 처리
            audio_base64 = message
            print(f"🎵 오디오 데이터 받음: {len(audio_base64)} bytes")

            try:
                user_message, ai_response = await ai_service.process_user_audio(user_id, audio_base64)

                if user_message:
                    await manager.send_json({"type": "user_message", "content": user_message}, user_id)
                    await manager.send_json({"type": "ai_message", "content": ai_response}, user_id)

                    session_conversations[user_id].append(f"사용자: {user_message}")
                    session_conversations[user_id].append(f"AI: {ai_response}")

                    # DB 저장
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

# ✨ 정시 대화 트리거 엔드포인트 (테스트용)
@router.post("/trigger-call/{user_id}")
async def trigger_scheduled_call(user_id: str):
    """수동으로 정시 대화 트리거 (테스트용)"""
    try:
        if user_id in manager.active_connections:
            await manager.send_json({
                "type": "scheduled_call",
                "content": "정시 대화 시간입니다! 대화를 시작하시겠어요?",
                "timestamp": datetime.now().isoformat()
            }, user_id)
            return {"status": "success", "message": f"{user_id}에게 정시 대화 알림을 전송했습니다"}
        else:
            return {"status": "info", "message": f"{user_id} 사용자가 현재 접속하지 않았습니다"}
            
    except Exception as e:
        print(f"❌ 정시 대화 트리거 실패: {str(e)}")
        return {"status": "error", "message": f"트리거 실패: {str(e)}"}