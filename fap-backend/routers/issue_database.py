from fastapi import APIRouter, Query, HTTPException, Request
from typing import List, Dict, Optional
from db_manager import DatabaseManager
from config import CUSTOMER_PROJECT_IDS
import json

def get_issue_project_ids(site_index: int, sub_site_name: str, product_name: str) -> List[int]: # 수정 불가
    """Site 인덱스, Sub Site, Product 이름으로 해당하는 프로젝트 ID들을 찾는 헬퍼 함수"""
    try:
        db = DatabaseManager()
        
        # 1. Sub Site 이름으로 프로젝트 정보 조회
        if sub_site_name == "ALL":
            # ALL인 경우 처리
            if product_name == "ALL":
                # Sub Site가 ALL이고 Product도 ALL인 경우
                # 1. Site index로 Site ID 찾기
                site_id = CUSTOMER_PROJECT_IDS[site_index]
                site_project = db.get_projects_by_ids([site_id])[0]
                
                # 2. Site의 모든 하위 프로젝트 ID들 수집
                all_product_ids = []
                
                # Site의 children_ids 가져오기
                children_ids = site_project.get('children_ids', [])
                if isinstance(children_ids, str):
                    children_ids = json.loads(children_ids)
                
                # 모든 Sub Site 프로젝트들 조회
                sub_projects = db.get_projects_by_ids(children_ids)
                
                # 각 Sub Site의 하위 프로젝트들 처리
                for sub_project in sub_projects:
                    sub_children_ids = sub_project.get('children_ids', [])
                    if isinstance(sub_children_ids, str):
                        sub_children_ids = json.loads(sub_children_ids)
                    
                    # Sub Site의 하위 프로젝트들 조회
                    sub_sub_projects = db.get_projects_by_ids(sub_children_ids)
                    
                    # Level 3과 Level 4 프로젝트들 처리
                    products_ids = []
                    for project in sub_sub_projects:
                        level = project.get('level', 0)
                        
                        if level == 4:
                            # Level 4라면 바로 ID 저장
                            all_product_ids.append(project.get('redmine_project_id'))
                        elif level == 3:
                            # Level 3이라면 하위 프로젝트 ID 리스트를 파싱해서 products_ids에 추가
                            children_ids_str = project.get('children_ids', '[]')
                            if isinstance(children_ids_str, str):
                                sub_children_ids = json.loads(children_ids_str)
                                products_ids.extend(sub_children_ids)
                    
                    # Level 3의 하위 프로젝트들 조회
                    if products_ids:
                        final_products = db.get_projects_by_ids(products_ids)
                        
                        # final_products에서 레벨 4인 프로젝트들만 저장
                        for project in final_products:
                            level = project.get('level', 0)
                            if level == 4:
                                all_product_ids.append(project.get('redmine_project_id'))
                
                return all_product_ids
            else:
                # Sub Site가 ALL이고 Product가 특정 이름인 경우
                # 1. Site index로 Site ID 찾기
                site_id = CUSTOMER_PROJECT_IDS[site_index]
                site_project = db.get_projects_by_ids([site_id])[0]
                
                # 2. Site의 모든 하위 프로젝트 ID들 수집
                all_product_ids = []
                
                # Site의 children_ids 가져오기
                children_ids = site_project.get('children_ids', [])
                if isinstance(children_ids, str):
                    children_ids = json.loads(children_ids)
                
                # 모든 Sub Site 프로젝트들 조회
                sub_projects = db.get_projects_by_ids(children_ids)
                
                # 각 Sub Site의 하위 프로젝트들 처리
                for sub_project in sub_projects:
                    sub_children_ids = sub_project.get('children_ids', [])
                    if isinstance(sub_children_ids, str):
                        sub_children_ids = json.loads(sub_children_ids)
                    
                    # Sub Site의 하위 프로젝트들 조회
                    sub_sub_projects = db.get_projects_by_ids(sub_children_ids)
                    
                    # Level 3과 Level 4 프로젝트들 처리
                    products_ids = []
                    for project in sub_sub_projects:
                        level = project.get('level', 0)
                        
                        if level == 4:
                            # Level 4라면 Product 이름이 포함된지 확인
                            project_name = project.get('project_name', '')
                            if product_name in project_name:
                                all_product_ids.append(project.get('redmine_project_id'))
                        elif level == 3:
                            # Level 3이라면 하위 프로젝트 ID 리스트를 파싱해서 products_ids에 추가
                            children_ids_str = project.get('children_ids', '[]')
                            if isinstance(children_ids_str, str):
                                sub_children_ids = json.loads(children_ids_str)
                                products_ids.extend(sub_children_ids)
                    
                    # Level 3의 하위 프로젝트들 조회
                    if products_ids:
                        final_products = db.get_projects_by_ids(products_ids)
                        
                        # final_products에서 레벨 4인 프로젝트들만 확인
                        for project in final_products:
                            level = project.get('level', 0)
                            if level == 4:
                                # Level 4라면 Product 이름이 포함된지 확인
                                project_name = project.get('project_name', '')
                                if product_name in project_name:
                                    all_product_ids.append(project.get('redmine_project_id'))
                
                return all_product_ids
        else:
            # 일반 Sub Site인 경우
            if product_name == "ALL":
                # Sub Site가 있고 Product가 ALL인 경우
                projects = db.get_projects_by_name(sub_site_name)
                
                if not projects or len(projects) == 0:
                    print(f"Sub Site '{sub_site_name}'을 찾을 수 없습니다.")
                    return []
                
                # children_ids를 JSON에서 파싱해서 ID 리스트로 변환
                children_ids = []
                if projects and len(projects) > 0:
                    children_ids_str = projects[0].get('children_ids', '[]')
                    if isinstance(children_ids_str, str):
                        children_ids = json.loads(children_ids_str)
                
                # children_ids로 하위 프로젝트들의 모든 정보 조회
                sub_projects = db.get_projects_by_ids(children_ids)
                
                # 모든 Level 4 프로젝트 ID 수집
                all_product_ids = []
                products_ids = []
                
                for project in sub_projects:
                    level = project.get('level', 0)
                    
                    if level == 4:
                        # Level 4라면 바로 ID 저장
                        all_product_ids.append(project.get('redmine_project_id'))
                    elif level == 3:
                        # Level 3이라면 하위 프로젝트 ID 리스트를 파싱해서 products_ids에 추가
                        children_ids_str = project.get('children_ids', '[]')
                        if isinstance(children_ids_str, str):
                            sub_children_ids = json.loads(children_ids_str)
                            products_ids.extend(sub_children_ids)
                
                # products_ids로 하위 프로젝트들의 모든 정보 조회
                final_products = db.get_projects_by_ids(products_ids)
                
                # final_products에서 레벨 4인 프로젝트들만 all_product_ids에 저장
                for project in final_products:
                    level = project.get('level', 0)
                    if level == 4:
                        all_product_ids.append(project.get('redmine_project_id'))
                
                return all_product_ids
            else:
                # Sub Site가 있고 Product가 특정 이름인 경우 (기존 로직)
                projects = db.get_projects_by_name(sub_site_name)
                
                if not projects or len(projects) == 0:
                    print(f"Sub Site '{sub_site_name}'을 찾을 수 없습니다.")
                    return []
                
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
                        # Level 4라면 Product 이름이 포함된지 확인
                        project_name = project.get('project_name', '')
                        if product_name in project_name:
                            # Product 이름이 포함된 경우 해당 ID 저장
                            products.append(project.get('redmine_project_id'))
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
                        # Level 4라면 Product 이름이 포함된지 확인
                        project_name = project.get('project_name', '')
                        if product_name in project_name:
                            # Product 이름이 포함된 경우 해당 ID 저장
                            products.append(project.get('redmine_project_id'))
                
                return products
        
    except Exception as e:
        print(f"get_issue_project_ids 실패: {e}")
        return []

router = APIRouter(prefix="/api/issues", tags=["issues"])

@router.post("/sync")
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
        
        # 7. products에서 직접 프로젝트 이름의 앞부분만 추출해서 중복 제거
        product_list = []
        import re
        
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

@router.post("/get-all-product-list")
async def get_all_product_list(request: Request):  # 수정 불가
    """모든 Sub Site의 Product List를 가져오는 새로운 API"""
    try:
        data = await request.json()
        sub_site_list = data.get('sub_site_list', [])
        
        if not sub_site_list:
            return {
                "success": True,
                "product_list": []
            }
        
        # 모든 Sub Site의 프로젝트 데이터 수집
        all_projects = []
        
        for sub_site_name in sub_site_list:
            # get_product_list 함수의 로직을 직접 호출하여 프로젝트 데이터 수집
            from .issue_database import get_product_list
            from fastapi import Query
            
            # get_product_list 함수 호출하여 프로젝트 데이터 가져오기
            result = await get_product_list(sub_project_name=sub_site_name)
            
            # 각 Sub Site의 프로젝트 데이터를 all_projects에 추가
            db = DatabaseManager()
            projects = db.get_projects_by_name(sub_site_name)
            
            if projects and len(projects) > 0:
                children_ids_str = projects[0].get('children_ids', '[]')
                if isinstance(children_ids_str, str):
                    children_ids = json.loads(children_ids_str)
                
                sub_projects = db.get_projects_by_ids(children_ids)
                
                # 레벨에 따라 처리
                products = []
                products_ids = []
                for project in sub_projects:
                    level = project.get('level', 0)
                    
                    if level == 4:
                        products.append(project)
                    elif level == 3:
                        children_ids_str = project.get('children_ids', '[]')
                        if isinstance(children_ids_str, str):
                            sub_children_ids = json.loads(children_ids_str)
                            products_ids.extend(sub_children_ids)
                
                final_products = db.get_projects_by_ids(products_ids)
                
                for project in final_products:
                    level = project.get('level', 0)
                    if level == 4:
                        products.append(project)
                
                all_projects.extend(products)
        
        # 중복 제거하여 Product List 생성
        product_list = []
        import re
        
        for project in all_projects:
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


@router.post("/get-issue-status-data")
async def get_issue_status_data(request: Request):
    """이슈 현황 탭 클릭 시 호출되는 API"""
    try:
        data = await request.json()
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        site_index = data.get('site_index')
        sub_site_name = data.get('sub_site_name')
        product_name = data.get('product_name')
        
        if not all([start_date, end_date, site_index is not None, sub_site_name, product_name]):
            raise HTTPException(status_code=400, detail="필수 파라미터가 누락되었습니다: start_date, end_date, site_index, sub_site_name, product_name")
        
        # 헬퍼 함수 호출하여 프로젝트 ID 리스트 가져오기
        project_ids = get_issue_project_ids(site_index, sub_site_name, product_name)
        
        # project_ids와 기간을 가지고 이슈 데이터 조회
        db = DatabaseManager()
        issues = db.get_issues_by_filter(start_date, end_date, project_ids)
        
        # tracker_name별로 카운트
        tracker_counts = {}
        for issue in issues:
            tracker_name = issue.get('tracker_name', 'Unknown')
            tracker_counts[tracker_name] = tracker_counts.get(tracker_name, 0) + 1
        
        # tracker별 카운트 리턴
        return {
            "success": True,
            "data": {
                "tracker_counts": tracker_counts
            }
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이슈 현황 데이터 조회 실패: {str(e)}") 


@router.post("/get-summary-report")
async def get_summary_report(request: Request):
    """주간 업무보고 요약 데이터 조회 API"""
    try:
        data = await request.json()
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        site_index = data.get('site_index')
        sub_site_name = data.get('sub_site_name')
        product_name = data.get('product_name')
        
        if not all([start_date, end_date, site_index is not None, sub_site_name, product_name]):
            raise HTTPException(status_code=400, detail="필수 파라미터가 누락되었습니다: start_date, end_date, site_index, sub_site_name, product_name")
        
        # 헬퍼 함수 호출하여 프로젝트 ID 리스트 가져오기
        project_ids = get_issue_project_ids(site_index, sub_site_name, product_name)
        
        # project_ids와 기간을 가지고 이슈 데이터 조회
        db = DatabaseManager()
        issues = db.get_issues_by_filter(start_date, end_date, project_ids)
        
        # 주간 업무보고 요약 데이터 생성
        summary_data = {
            "total_issues": len(issues),
            "status_summary": {},
            "priority_summary": {},
            "assignee_summary": {}
        }
        
        # 상태별, 우선순위별, 담당자별 요약
        for issue in issues:
            # 상태별 카운트
            status = issue.get('status_name', 'Unknown')
            summary_data["status_summary"][status] = summary_data["status_summary"].get(status, 0) + 1
            
            # 우선순위별 카운트
            priority = issue.get('priority_name', 'Unknown')
            summary_data["priority_summary"][priority] = summary_data["priority_summary"].get(priority, 0) + 1
            
            # 담당자별 카운트
            assignee = issue.get('assigned_to_name', 'Unassigned')
            summary_data["assignee_summary"][assignee] = summary_data["assignee_summary"].get(assignee, 0) + 1
        
        return {
            "success": True,
            "data": summary_data
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"주간 업무보고 데이터 조회 실패: {str(e)}") 

