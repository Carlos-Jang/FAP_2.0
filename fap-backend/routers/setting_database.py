"""
FAP 2.0 - 시스템 설정 및 관리 API 라우터 (백엔드)

주요 기능:
- 사용자 API 키 관리: 개인별 레드마인 API 키 저장/조회 (암호화)
- 데이터 동기화 관리: 일감, 프로젝트, 이슈 상태 목록 동기화
- 로드맵 데이터 동기화: 로드맵 정보 및 연결된 이슈 동기화

API 엔드포인트:
- /save-user-api-key: 개인 API 키 저장
- /check-user-api-key/{login}: 사용자 API 키 존재 여부 확인
- /sync-statuses: 이슈 상태 목록 동기화
- /sync-issues: 레드마인에서 일감 데이터 동기화
- /sync-projects: 레드마인에서 프로젝트 데이터 동기화
- /sync-roadmap-data: 로드맵 데이터 동기화

기술 스택:
- FastAPI
- MariaDB (DatabaseManager)
- Redmine API 연동
- 암호화 (Fernet)
"""

from fastapi import APIRouter, HTTPException, Request, Query
from typing import Dict
from db_manager import DatabaseManager

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.post("/save-user-api-key")
async def save_user_api_key(request: Request): # 수정 불가
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
async def check_user_api_key(login: str): # 수정 불가
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

@router.post("/save-user-products")
async def save_user_products(request: Request):
    """사용자 Product 설정 저장"""
    try:
        data = await request.json()
        user_id = data.get('user_id')
        selected_products = data.get('selected_products', [])

        if not user_id:
            raise HTTPException(status_code=400, detail="필수 파라미터가 누락되었습니다: user_id")

        # DB 매니저를 통한 Product 설정 저장
        db = DatabaseManager()
        result = db.save_user_products(user_id, selected_products)
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("message", "Product 설정 저장 실패"))
        
        return {
            "success": True,
            "message": result.get("message", "Product 설정이 성공적으로 저장되었습니다."),
            "data": result.get("data", {})
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Product 설정 저장 실패: {str(e)}")

@router.get("/get-user-products")
async def get_user_products(user_id: str = Query(..., description="사용자 ID")):
    """사용자 Product 설정 조회"""
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="필수 파라미터가 누락되었습니다: user_id")

        # DB 매니저를 통한 Product 설정 조회
        db = DatabaseManager()
        result = db.get_user_products(user_id)
        
        return {
            "success": result.get("success", False),
            "message": result.get("message", ""),
            "data": result.get("data", {})
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Product 설정 조회 실패: {str(e)}")

@router.post("/sync-statuses")
async def sync_issue_statuses(): # 수정 불가
    """이슈 상태 목록 동기화"""
    try:
        # DB 매니저를 통한 이슈 상태 동기화
        db = DatabaseManager()
        result = db.sync_issue_status()
        
        return {
            "success": result.get("success", False),
            "message": result.get("message", ""),
            "data": result.get("data", {})
        }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이슈 상태 동기화 실패: {str(e)}")

@router.post("/sync-issues")
async def sync_issues(limit: int = Query(100, ge=1, le=10000, description="동기화할 일감 수")):  # 수정 불가
    """레드마인에서 일감 동기화"""
    try:
        db = DatabaseManager()
        # result = db.sync_recent_issues(limit)  # 기존 함수 주석 처리
        result = db.sync_recent_issues_full_data(limit)  # 새로운 함수로 테스트
        
        if result['success']:
            return {
                "success": True,
                "message": result['message'],
                "data": {
                    "count": result['count'],
                    "saved": result.get('saved', 0),
                    "updated": result.get('updated', 0)
                }
            }
        else:
            raise HTTPException(status_code=500, detail=result['error'])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"동기화 실패: {str(e)}")

@router.post("/sync-projects")
async def sync_projects(limit: int = Query(1000, ge=1, le=1000, description="동기화할 프로젝트 수")):  # 수정 불가
    """레드마인에서 프로젝트 동기화 (빠른 동기화)"""
    try:
        db = DatabaseManager()
        result = db.sync_projects_fast(limit)  # 빠른 동기화 함수 사용
        
        if result['success']:
            return {
                "success": True,
                "message": result['message'],
                "data": {
                    "count": result['count'],
                    "saved": result.get('saved', 0),
                    "updated": result.get('updated', 0)
                }
            }
        else:
            raise HTTPException(status_code=500, detail=result['error'])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"프로젝트 동기화 실패: {str(e)}")

@router.post("/sync-roadmap-data")
async def sync_roadmap_data():  # 수정 불가
    """레드맵 데이터 동기화"""
    try:
        db = DatabaseManager()
        result = db.sync_roadmap_data()
        
        if result['success']:
            return {
                "success": True,
                "message": result['message'],
                "data": {
                    "count": result['count'],
                    "saved": result.get('saved', 0),
                    "updated": result.get('updated', 0)
                }
            }
        else:
            raise HTTPException(status_code=500, detail=result['error'])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"로드맵 데이터 동기화 실패: {str(e)}") 