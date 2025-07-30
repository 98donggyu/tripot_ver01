# scripts/generate_reports.py

import os
import sys
from pathlib import Path
from datetime import date, timedelta

# --- 스크립트가 'app' 모듈을 찾을 수 있도록 경로 설정 ---
# 이 스크립트 파일의 위치를 기준으로 프로젝트 루트 경로를 계산합니다.
# scripts -> backend -> project root
project_root = Path(__file__).resolve().parents[1] 
sys.path.append(str(project_root))
# ---------------------------------------------------------

# 이제 app 내부의 모듈을 안전하게 임포트할 수 있습니다.
from app.services import ai_service
from app.db import report_utils

def main():
    """
    어제 대화 기록이 있는 모든 사용자에 대해 일일 리포트를 생성하고 DB에 저장합니다.
    """
    yesterday = date.today() - timedelta(days=1)
    print(f"--- 📅 {yesterday} 리포트 생성 작업 시작 ---")

    # 1. 어제 대화한 모든 사용자 ID 가져오기
    user_ids = report_utils.get_all_user_ids_for_yesterday()
    if not user_ids:
        print("✅ 어제 대화한 사용자가 없습니다. 작업을 종료합니다.")
        return

    print(f"👥 총 {len(user_ids)}명의 사용자에 대한 리포트를 생성합니다: {user_ids}")

    # 2. 각 사용자에 대해 리포트 생성 및 저장
    for user_id in user_ids:
        print(f"\n--- 🔄 사용자 [{user_id}] 처리 시작 ---")
        
        # 2-1. 사용자의 어제 대화 내용 가져오기
        conversation_text = report_utils.fetch_daily_conversations(user_id, yesterday)
        if not conversation_text:
            print(f"💬 사용자 [{user_id}]의 대화 내용이 없습니다. 건너뜁니다.")
            continue
        
        print(f"📝 대화 내용 로드 완료 (길이: {len(conversation_text)})")
        
        # 2-2. AI를 통해 리포트 생성
        # ai_service에 이미 만들어 둔 함수를 재사용합니다.
        report_json = ai_service.generate_summary_report(conversation_text)
        if not report_json:
            print(f"❌ AI 리포트 생성 실패. 다음 사용자로 넘어갑니다.")
            continue

        print(f"🤖 AI 리포트 생성 완료")

        # 2-3. 생성된 리포트를 DB에 저장
        # report_utils에 만들어 둔 함수를 재사용합니다.
        success = report_utils.save_summary_to_db(user_id, yesterday, report_json)
        if success:
            print(f"🎉 사용자 [{user_id}]의 리포트가 성공적으로 저장되었습니다.")
        else:
            print(f"❌ 사용자 [{user_id}]의 리포트 저장에 실패했습니다.")
    
    print("\n--- ✅ 모든 작업 완료 ---")


if __name__ == "__main__":
    main()