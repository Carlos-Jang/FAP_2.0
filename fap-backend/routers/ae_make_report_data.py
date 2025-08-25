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

@router.get("/site")
async def get_site():
    """고객사 프로젝트 목록 조회 (SITE 버튼용) - 기존과 동일한 UI"""
    try:
        db = DatabaseManager()
        projects = db.get_projects_by_ids(CUSTOMER_PROJECT_IDS)
        
        # 프로젝트 이름에서 번호 제거 (예: "01. 삼성전자" -> "삼성전자")
        site_list = []
        for project in projects:
            project_name = project.get('project_name', '')
            # "01. ", "02. " 등의 번호 제거
            clean_name = re.sub(r'^\d+\.\s*', '', project_name)
            
            site_list.append({
                'project_name': clean_name
            })
        
        return {
            "success": True,
            "projects": site_list
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SITE 조회 실패: {str(e)}")

@router.get("/sub-site") 
async def get_sub_site(site_index: int = Query(..., description="SITE 버튼 인덱스")):
    """SITE 버튼 인덱스로 SITE ID 조회 - 기존과 동일한 UI"""
    site_id = CUSTOMER_PROJECT_IDS[site_index]
    
    db = DatabaseManager()
    project_info = db.get_projects_by_ids([site_id])
    
    if not project_info:
        return {"success": True, "projects": [{"project_name": "ALL"}]}
    
    children_ids = project_info[0].get('children_ids', [])
    # JSON 문자열을 파싱해서 숫자 리스트로 변환
    if isinstance(children_ids, str):
        children_ids = json.loads(children_ids)
    sub_projects = db.get_projects_by_ids(children_ids)
    
    sub_site_list = []
    sub_site_list.append({
        'project_name': 'ALL'
    })
    
    for project in sub_projects:
        sub_site_list.append({
            'project_name': project.get('project_name', '')
        })
    
    return {
        "success": True,
        "projects": sub_site_list
    }

@router.get("/product-list")
async def get_product_list(sub_project_name: str = Query(..., description="SUB 프로젝트 이름")):
    """SUB 프로젝트 이름으로 레벨4 프로젝트 목록 조회 - 기존과 동일한 UI"""
    try:
        db = DatabaseManager()
        
        # 1. SUB 프로젝트 이름으로 프로젝트 정보 조회
        projects = db.get_projects_by_name(sub_project_name)
        
        # 2. children_ids를 JSON에서 파싱해서 ID 리스트로 변환
        children_ids = []
        if projects and len(projects) > 0:
            children_ids_str = projects[0].get('children_ids', '[]')
            if isinstance(children_ids_str, str):
                children_ids = json.loads(children_ids_str)
        
        # 3. children_ids로 하위 프로젝트들의 모든 정보 조회
        sub_projects = db.get_projects_by_ids(children_ids)
        
        # 4. 레벨에 따라 처리
        products = []
        products_ids = []
        for project in sub_projects:
            level = project.get('level', 0)
            
            if level == 4:
                # Level 4라면 모든 정보를 저장
                products.append(project)
            elif level == 3:
                # Level 3이라면 하위 프로젝트 ID 리스트를 파싱해서 products_ids에 추가
                children_ids_str = project.get('children_ids', '[]')
                if isinstance(children_ids_str, str):
                    sub_children_ids = json.loads(children_ids_str)
                    products_ids.extend(sub_children_ids)
        
        # 5. products_ids로 하위 프로젝트들의 모든 정보 조회
        final_products = db.get_projects_by_ids(products_ids)
        
        # 6. final_products에서 레벨 4인 프로젝트들만 products에 저장
        for project in final_products:
            level = project.get('level', 0)
            if level == 4:
                products.append(project)
        
        # 7. products에서 직접 프로젝트 이름의 앞부분만 추출해서 중복 제거
        product_list = []
        
        for project in products:
            project_name = project.get('project_name', '')
            # "#01", "#02" 등의 패턴 앞부분 추출
            match = re.match(r'^(.+?)\s+#\d+', project_name)
            if match:
                prefix = match.group(1).strip()
                if prefix not in [p.get('name') for p in product_list]:
                    product_list.append({
                        'name': prefix
                    })
        
        # 9. ALL을 제일 처음에 추가
        product_list.insert(0, {'name': 'ALL'})
        
        return {
            "success": True,
            "product_list": product_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Product List 조회 실패: {str(e)}")

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
            "product": issue_data.get("custom_fields", [])  # Product 정보는 custom_fields에서 추출 필요
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
    담당자별 일감 조회 API
    """
    try:
        worker_name = request.get("worker_name")
        if not worker_name:
            raise HTTPException(status_code=400, detail="담당자 이름이 필요합니다.")
        
        # Redmine에서 일괄 조회로 일감 데이터 가져오기
        all_issues = fetch_redmine_issues(limit=50, offset=0)
        
        # 담당자별로 필터링
        filtered_issues = []
        for issue in all_issues:
            assigned_to_name = issue.get("assigned_to_name", "")
            author_name = issue.get("author_name", "")
            
            # 담당자 이름 또는 작성자 이름이 일치하는 경우
            if worker_name in assigned_to_name or worker_name in author_name:
                filtered_issues.append(issue)
        
        print(f"담당자별 일감 조회: {worker_name}, 전체: {len(all_issues)}개, 필터링: {len(filtered_issues)}개")
        
        return {
            "success": True,
            "message": f"{worker_name} 담당자의 일감 조회 성공",
            "data": filtered_issues
        }
            
    except Exception as e:
        print(f"담당자별 일감 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"담당자별 일감 조회 중 오류가 발생했습니다: {str(e)}")
