from fastapi import APIRouter, Query, HTTPException, Request
from typing import List, Dict, Optional
from db_manager import DatabaseManager
from config import CUSTOMER_PROJECT_IDS
import json

# 전역 캐시 변수
product_cache = [] # 수정 불가
all_product_cache = [] # 수정 불가

def extract_project_ids_and_names(projects: List[Dict]): # 수정 불가
    """프로젝트 리스트에서 ID와 이름만 캐시에 저장하는 헬퍼 함수"""
    global product_cache
    product_cache = []
    for project in projects:
        product_cache.append({
            'project_id': project.get('redmine_project_id', 0),
            'project_name': project.get('project_name', '')
        })

router = APIRouter(prefix="/api/issues", tags=["issues"])

@router.post("/sync")
async def sync_issues(limit: int = Query(100, ge=1, le=10000, description="동기화할 일감 수")):  # 수정 불가
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

@router.post("/sync-projects")
async def sync_projects(limit: int = Query(1000, ge=1, le=1000, description="동기화할 프로젝트 수")):  # 수정 불가
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

@router.get("/site")
async def get_site(): # 수정 불가
    """고객사 프로젝트 목록 조회 (SITE 버튼용)"""
    try:
        db = DatabaseManager()
        projects = db.get_projects_by_ids(CUSTOMER_PROJECT_IDS)
        
        # 프로젝트 이름에서 번호 제거 (예: "01. 삼성전자" -> "삼성전자")
        site_list = []
        for project in projects:
            project_name = project.get('project_name', '')
            # "01. ", "02. " 등의 번호 제거
            import re
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
async def get_sub_site(site_index: int = Query(..., description="SITE 버튼 인덱스")): # 수정 불가
    """SITE 버튼 인덱스로 SITE ID 조회"""
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
async def get_product_list(sub_project_name: str = Query(..., description="SUB 프로젝트 이름")): # 수정 불가
    """SUB 프로젝트 이름으로 레벨4 프로젝트 목록 조회"""
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
        
        # 7. products에서 ID와 이름만 캐시에 저장
        extract_project_ids_and_names(products)
        
        # 8. 캐시에서 프로젝트 이름의 앞부분만 추출해서 중복 제거
        product_list = []
        import re
        
        for project in product_cache:
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

@router.post("/get-all-product-list")
async def get_all_product_list(request: Request):
    """모든 Sub Site의 Product List를 가져오는 새로운 API"""
    try:
        data = await request.json()
        sub_site_list = data.get('sub_site_list', [])
        
        if not sub_site_list:
            return {
                "success": True,
                "product_list": []
            }
        
        # ALL 전용 캐시 초기화
        global all_product_cache
        all_product_cache = []
        
        # 각 Sub Site마다 get_product_list 함수 호출하여 캐시 내용 수집
        for sub_site_name in sub_site_list:
            # get_product_list 함수의 로직을 직접 호출하여 캐시에 저장
            from .issue_database import get_product_list
            from fastapi import Query
            
            # get_product_list 함수 호출 (캐시에 저장됨)
            result = await get_product_list(sub_project_name=sub_site_name)
            
            # 현재 product_cache 내용을 all_product_cache에 추가
            from .issue_database import product_cache
            all_product_cache.extend(product_cache)
        
        # for문이 끝나면 all_product_cache를 ALL Product List 캐시에 저장
        # (이미 all_product_cache에 저장되어 있음)
        
        # 중복 제거하여 Product List 생성
        product_list = []
        import re
        
        for project in all_product_cache:
            project_name = project.get('project_name', '')
            match = re.match(r'^(.+?)\s+#\d+', project_name)
            if match:
                prefix = match.group(1).strip()
                if prefix not in [p.get('name') for p in product_list]:
                    product_list.append({
                        'name': prefix
                    })
        
        # ALL을 제일 처음에 추가
        product_list.insert(0, {'name': 'ALL'})
        
        return {
            "success": True,
            "product_list": product_list
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"전체 Product List 조회 실패: {str(e)}") 

