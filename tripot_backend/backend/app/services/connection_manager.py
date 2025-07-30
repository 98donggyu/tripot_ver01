# app/services/connection_manager.py
# 웹소켓 연결을 중앙에서 관리하는 독립 모듈

import json
from fastapi import WebSocket

class ConnectionManager:
    """활성 WebSocket 연결을 관리하는 중앙 관리자 클래스"""
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

# 다른 모든 파일에서 이 인스턴스를 공유하여 사용합니다.
manager = ConnectionManager()