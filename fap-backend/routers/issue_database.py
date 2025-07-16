from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict, Optional
from db_manager import DatabaseManager
import json

router = APIRouter(prefix="/api/issues", tags=["issues"])

@router.get("/")
async def get_issues(
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
    search: Optional[str] = Query(None, description="검색 키워드")
):
    """일감 목록 조회"""
    try:
        db = DatabaseManager()
        offset = (page - 1) * limit
        
        if search:
            issues = db.search_issues(search, limit)
        else:
            issues = db.get_all_issues(limit, offset)
        
        total_count = db.get_issue_count()
        
        return {
            "success": True,
            "data": {
                "issues": issues,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "total_pages": (total_count + limit - 1) // limit
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"일감 조회 실패: {str(e)}")

@router.get("/{issue_id}")
async def get_issue(issue_id: int):
    """특정 일감 조회"""
    try:
        db = DatabaseManager()
        issue = db.get_issue_by_id(issue_id)
        
        if not issue:
            raise HTTPException(status_code=404, detail="일감을 찾을 수 없습니다")
        
        return {
            "success": True,
            "data": issue
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"일감 조회 실패: {str(e)}")

@router.post("/sync")
async def sync_issues(limit: int = Query(100, ge=1, le=1000, description="동기화할 일감 수")):
    """레드마인에서 일감 동기화"""
    try:
        db = DatabaseManager()
        result = db.sync_recent_issues(limit)
        
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

@router.get("/stats/summary")
async def get_issue_stats():
    """일감 통계 요약"""
    try:
        db = DatabaseManager()
        total_count = db.get_issue_count()
        
        # 최근 일감 100개로 상태별 통계
        recent_issues = db.get_all_issues(100)
        
        status_stats = {}
        priority_stats = {}
        tracker_stats = {}
        
        for issue in recent_issues:
            data = issue.get('data', {})
            
            # 상태별 통계
            status = data.get('status', {}).get('name', 'Unknown')
            status_stats[status] = status_stats.get(status, 0) + 1
            
            # 우선순위별 통계
            priority = data.get('priority', {}).get('name', 'Unknown')
            priority_stats[priority] = priority_stats.get(priority, 0) + 1
            
            # 트래커별 통계
            tracker = data.get('tracker', {}).get('name', 'Unknown')
            tracker_stats[tracker] = tracker_stats.get(tracker, 0) + 1
        
        return {
            "success": True,
            "data": {
                "total_count": total_count,
                "recent_count": len(recent_issues),
                "status_stats": status_stats,
                "priority_stats": priority_stats,
                "tracker_stats": tracker_stats
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"통계 조회 실패: {str(e)}")

@router.post("/sync-projects")
async def sync_projects(limit: int = Query(1000, ge=1, le=10000, description="동기화할 프로젝트 수")):
    """레드마인에서 프로젝트 동기화"""
    try:
        db = DatabaseManager()
        result = db.sync_projects(limit)
        
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