"""
FAP 2.0 - AE Make Report 라우터 (백엔드)

주요 기능:
- AE Make Report 페이지 관련 API 엔드포인트 제공
- 일감 검색 및 조회 기능 (Redmine API 직접 사용)
- 사이트/위치 정보 조회
- 엑셀 보고서 다운로드

API 엔드포인트:
- /site: 고객사 프로젝트 목록 조회
- /sub-site: 하위 사이트 목록 조회
- /product-list: Product 목록 조회
- /get-progress-data: 일감 데이터 조회 (Redmine API 사용)

기술 스택:
- FastAPI
- Redmine API 연동
- 엑셀 파일 처리
"""

from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Dict, Optional, Any
import requests
from db_manager import DatabaseManager
from config import CUSTOMER_PROJECT_IDS
from redmine_service import fetch_redmine_issue, fetch_redmine_issues, REDMINE_URL, REDMINE_API_KEY, get_parent_issue_id, get_project_name

import json
import re

router = APIRouter(prefix="/api/ae-make-report", tags=["AE Make Report"])



@router.post("/get-issue-by-number")
async def get_issue_by_number(request: Request):
    """일감 번호로 일감 조회"""
    try:
        data = await request.json()
        issue_id = data.get('issue_id')
        
        if not issue_id:
            raise HTTPException(status_code=400, detail="일감 번호가 필요합니다")
        
        # Redmine API에서 실제 일감 정보 조회
        issue_data = fetch_redmine_issue(int(issue_id))
        
        if not issue_data:
            raise HTTPException(status_code=404, detail=f"일감 #{issue_id}을 찾을 수 없습니다")
        
        # Redmine 응답을 FAP 형식으로 변환
        formatted_issue = {
            "redmine_id": issue_data.get("id"),
            "subject": issue_data.get("subject", ""),
            "author_name": issue_data.get("author", {}).get("name", ""),
            "status_name": issue_data.get("status", {}).get("name", ""),
            "created_at": issue_data.get("created_on", ""),
            "updated_at": issue_data.get("updated_on", ""),
            "description": issue_data.get("description", ""),
            "is_closed": 1 if issue_data.get("closed_on") else 0,
            "tracker_name": issue_data.get("tracker", {}).get("name", ""),
            "product": issue_data.get("custom_fields", []),  # Product 정보는 custom_fields에서 추출 필요
            "project_name": issue_data.get("project", {}).get("name", "")
        }
        
        return {
            "success": True,
            "message": "일감 조회 성공",
            "data": formatted_issue
        }
        
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="올바른 일감 번호를 입력해주세요")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"일감 조회 실패: {str(e)}")

@router.post("/get-issues-by-worker")
async def get_issues_by_worker(request: Dict[str, Any]):
    """
    담당자별 일감 조회 API (페이지네이션 지원)
    """
    try:
        worker_name = request.get("worker_name")
        page = request.get("page", 1)  # 페이지 번호 (1, 2, 3, 4, 5...)
        
        if not worker_name:
            raise HTTPException(status_code=400, detail="담당자 이름이 필요합니다.")
        
        # 페이지 번호를 offset으로 변환 (페이지당 500개)
        offset = (page - 1) * 500
        
        # 5개 요청을 병렬로 처리 (각각 100개씩 = 총 500개)
        import asyncio
        
        async def fetch_batch(batch_offset):
            return fetch_redmine_issues(limit=100, offset=batch_offset)
        
        # 병렬 처리
        offsets = [offset + (i * 100) for i in range(5)]  # 0, 100, 200, 300, 400
        tasks = [fetch_batch(off) for off in offsets]
        all_issues_batches = await asyncio.gather(*tasks)
        
        # 모든 일감 합치기
        all_issues = []
        for batch in all_issues_batches:
            all_issues.extend(batch)
        
        # 담당자별로 필터링
        filtered_issues = []
        for issue in all_issues:
            assigned_to_name = issue.get("assigned_to_name", "")
            author_name = issue.get("author_name", "")
            
            # 담당자 이름 또는 작성자 이름이 일치하는 경우
            if worker_name in assigned_to_name or worker_name in author_name:
                filtered_issues.append(issue)
        
        # 탐색 범위 계산
        start_range = offset + 1
        end_range = offset + 500
        
        print(f"담당자별 일감 조회: {worker_name}, 페이지: {page}, 탐색범위: {start_range}~{end_range}, 전체: {len(all_issues)}개, 필터링: {len(filtered_issues)}개")
        
        return {
            "success": True,
            "message": f"{worker_name} 담당자의 일감 조회 성공",
            "data": filtered_issues,
            "search_range": f"{start_range}~{end_range}번 일감 탐색됨",
            "page": page
        }
            
    except Exception as e:
        print(f"담당자별 일감 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"담당자별 일감 조회 중 오류가 발생했습니다: {str(e)}")
