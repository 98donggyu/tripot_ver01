from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services import report_service # 1단계에서 만든 서비스 import

router = APIRouter()

@router.get("/reports/{senior_user_id}")
def get_senior_report_api(senior_user_id: str, db: Session = Depends(get_db)):
    """
    가족 앱이 호출할 어르신 리포트 조회 API 엔드포인트입니다.
    """
    # report_service를 호출하여 데이터를 가져옵니다.
    report_data = report_service.get_report_by_user_id(db, senior_user_id)
    
    # 조회된 데이터를 클라이언트에게 반환합니다.
    return report_data