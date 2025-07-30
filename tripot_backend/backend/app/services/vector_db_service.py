# app/services/vector_db_service.py (새 이름으로 저장)

import uuid
import time
import asyncio
from pinecone import Pinecone, ServerlessSpec

from app.core.config import settings
from . import ai_service # 개선된 ai_service를 임포트

# Pinecone 클라이언트 초기화 및 인덱스 연결
try:
    pc = Pinecone(api_key=settings.PINECONE_API_KEY)
    
    if settings.PINECONE_INDEX_NAME not in pc.list_indexes().names():
        print(f"Pinecone 인덱스 '{settings.PINECONE_INDEX_NAME}'가 없으므로 새로 생성합니다.")
        pc.create_index(
            name=settings.PINECONE_INDEX_NAME, 
            dimension=1536,
            metric="cosine", 
            spec=ServerlessSpec(cloud="aws", region="us-east-1")
        )
    
    index = pc.Index(settings.PINECONE_INDEX_NAME)
    print(f"✅ Pinecone '{settings.PINECONE_INDEX_NAME}' 인덱스에 성공적으로 연결되었습니다.")
except Exception as e:
    print(f"❌ Pinecone 초기화 중 오류 발생: {e}")
    index = None


async def create_memory_for_pinecone(user_id: str, current_session_log: list[str]):
    """세션 대화 내용을 바탕으로 Pinecone에 기억을 저장합니다."""
    if not index:
        print("Pinecone 인덱스가 없어 기억을 저장할 수 없습니다.")
        return

    if not current_session_log: return
    print(f"🧠 [{user_id}] 님의 세션 기억 생성을 시작합니다.")

    memory_text = ""
    memory_type = ""

    if len(current_session_log) < 4:
        # 짧은 대화는 원문 그대로 저장
        print("-> 짧은 대화로 판단, 'utterance' 타입으로 저장합니다.")
        memory_text = "\n".join(current_session_log)
        memory_type = 'utterance'
    else:
        # 긴 대화는 요약해서 저장 (동료분의 개선된 프롬프트 방식 적용)
        print("-> 긴 대화로 판단, 'summary' 타입으로 요약 생성합니다.")
        conversation_history = "\n".join(current_session_log)
        
        summary_system_message = """
        당신은 사용자 대화 기록을 분석하여 핵심적인 기억을 추출하고 요약하는 AI입니다.
        다음 대화 기록에서 사용자의 중요한 경험, 감정, 반복되는 주제, 특이사항 등을 간결하게 요약해주세요.
        요약된 내용은 다른 AI가 사용자의 과거를 회상하고 대화에 활용하는 데 사용됩니다.
        존댓말을 사용하고, 대화 형식으로 답변하지 마세요. (예: "사용자는 오늘 병원에 다녀온 경험에 대해 이야기했습니다.")
        규칙: 지명, 인명 등 모든 고유명사는 반드시 포함시켜야 합니다.
        """
        summary_user_message = f"--- 대화 내용 ---\n{conversation_history}\n-----------------\n\n핵심 기억 요약:"
        
        messages_for_summary = [
            {"role": "system", "content": summary_system_message},
            {"role": "user", "content": summary_user_message}
        ]

        memory_text = await ai_service.get_ai_chat_completion(
            messages=messages_for_summary, # 개선된 함수에 messages 리스트 전달
            max_tokens=200,
            temperature=0.3
        )
        memory_type = 'summary'

    print(f"📝 생성된 기억 (타입: {memory_type}): {memory_text}")
    embedding = await ai_service.get_embedding(memory_text)
    
    vector_to_upsert = {
        'id': str(uuid.uuid4()), 
        'values': embedding,
        'metadata': {
            'user_id': user_id, 
            'text': memory_text, 
            'timestamp': int(time.time()), 
            'memory_type': memory_type
        }
    }
    await asyncio.to_thread(index.upsert, vectors=[vector_to_upsert])
    print(f"✅ [{user_id}] 님의 새로운 기억이 Pinecone에 저장되었습니다.")


async def search_memories(user_id: str, query_message: str, top_k: int = 5) -> str:
    """과거 기억을 검색하고, 관련도와 최신성을 고려하여 최종 기억 목록을 반환합니다."""
    if not index:
        print("Pinecone 인덱스가 없어 기억을 검색할 수 없습니다.")
        return ""
        
    query_embedding = await ai_service.get_embedding(query_message)
    results = await asyncio.to_thread(
        index.query, 
        vector=query_embedding, 
        top_k=top_k, 
        filter={'user_id': user_id}, 
        include_metadata=True
    )
    
    if not results['matches']:
        return ""

    now = int(time.time())
    ranked_memories = []
    time_decay_factor = 30 * 24 * 60 * 60  # 30일

    for match in results['matches']:
        similarity_score = match['score']
        metadata = match.get('metadata', {})
        timestamp = metadata.get('timestamp', now)
        
        recency_score = max(0, (timestamp - (now - time_decay_factor)) / time_decay_factor)
        final_score = (similarity_score * 0.7) + (recency_score * 0.3)
        ranked_memories.append({'text': metadata.get('text', ''), 'score': final_score})
        
    ranked_memories.sort(key=lambda x: x['score'], reverse=True)
    top_memories = [item['text'] for item in ranked_memories[:3]]
    
    print(f"🔍 [{user_id}] 님의 과거 기억 {len(top_memories)}개를 검색했습니다.")
    return "\n".join(top_memories)