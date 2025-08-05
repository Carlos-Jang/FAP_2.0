"""
FAP Setting Database Router
설정 관련 API 엔드포인트들을 관리하는 모듈
"""

from fastapi import APIRouter, HTTPException, Request
from typing import Dict
from db_manager import DatabaseManager

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.post("/save-user-api-key")
async def save_user_api_key(request: Request):
    """사용자 API 키 저장"""
    try:
        data = await request.json()
        api_key = data.get('api_key')

        if not api_key:
            raise HTTPException(status_code=400, detail="필수 파라미터가 누락되었습니다: api_key")

        # DB 매니저를 통한 API 키 저장
        db = DatabaseManager()
        result = db.save_user_api_key(api_key)
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("message", "API 키 저장 실패"))
        
        return {
            "success": True,
            "message": result.get("message", "API 키가 성공적으로 저장되었습니다."),
            "data": result.get("data", {})
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"API 키 저장 실패: {str(e)}")

@router.get("/check-user-api-key/{login}")
async def check_user_api_key(login: str):
    """사용자 API 키 존재 여부 확인"""
    try:
        if not login:
            raise HTTPException(status_code=400, detail="필수 파라미터가 누락되었습니다: login")

        # DB 매니저를 통한 API 키 조회
        db = DatabaseManager()
        result = db.get_user_api_key(login)
        
        return {
            "success": result.get("success", False),
            "message": result.get("message", ""),
            "data": result.get("data", None)
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"API 키 조회 실패: {str(e)}") 