from fastapi import APIRouter, Query, HTTPException, Request
from typing import List, Dict, Optional
from db_manager import DatabaseManager
from config import CUSTOMER_PROJECT_IDS
import json

def get_overall_issue_status(issues: List[Dict]) -> Dict:
    """전체 이슈 현황 계산 헬퍼 함수"""
    total_issues = len(issues)
    
    # 완료율 계산
    completed_count = sum(1 for issue in issues if issue.get('is_closed') == 1)
    in_progress_count = total_issues - completed_count
    completion_rate = (completed_count / total_issues * 100) if total_issues > 0 else 0
    
    # 모든 일감 유형별 카운트 (완료/미완료 구분 없이)
    tracker_counts = {}
    for issue in issues:
        tracker_name = issue.get('tracker_name', 'Unknown')
        # 대괄호 제거하고 깔끔한 이름으로 변환
        clean_name = tracker_name.replace('[AE][이슈] ', '').replace('[AE][Setup] ', '').replace('[AE] ', '')
        tracker_counts[clean_name] = tracker_counts.get(clean_name, 0) + 1
    
    # tracker별 텍스트 생성
    tracker_text_parts = []
    
    for tracker_name, count in tracker_counts.items():
        # tracker별 고정 색상 매핑
        if 'HW' in tracker_name:
            color = '#FF6B6B'  # 빨간색
        elif 'SW' in tracker_name:
            color = '#4CAF50'  # 초록색
        elif 'AE' in tracker_name:
            color = '#2196F3'  # 파란색
        else:
            color = '#222222'  # 검정색
        
        # 모든 tracker를 동일한 폰트 크기로 표시
        tracker_text_parts.append(f'<span style="color: {color}">{tracker_name}: {count}건</span>')
    
    # 3개씩 그룹으로 나누어서 줄바꿈
    tracker_text = ""
    for i in range(0, len(tracker_text_parts), 3):
        group = tracker_text_parts[i:i+3]
        tracker_text += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;".join(group)
        if i + 3 < len(tracker_text_parts):  # 마지막 그룹이 아니면 줄바꿈 추가
            tracker_text += "<br>"
    
    return {
        "total_issues": total_issues,
        "completed_count": completed_count,
        "in_progress_count": in_progress_count,
        "completion_rate": round(completion_rate, 1),
        "tracker_text": tracker_text
    }


def get_most_problematic_products(issues: List[Dict]) -> Dict:
    """가장 문제가 많은 Product Top 3 계산 헬퍼 함수"""
    # Product별 통계 계산
    product_stats = {}
    
    for issue in issues:
        project_name = issue.get('project_name', '')
        is_closed = issue.get('is_closed', 0)
        
        # Product 이름 추출 (예: "설비A #01" -> "설비A")
        if '#' in project_name:
            product_name = project_name.split('#')[0].strip()
        else:
            product_name = project_name
        
        if product_name not in product_stats:
            product_stats[product_name] = {
                'in_progress': 0,
                'completed': 0,
                'total': 0
            }
        
        product_stats[product_name]['total'] += 1
        if is_closed == 1:
            product_stats[product_name]['completed'] += 1
        else:
            product_stats[product_name]['in_progress'] += 1
    
    # 진행중인 일감 수로 정렬하여 Top 3 선별
    sorted_products = sorted(
        product_stats.items(), 
        key=lambda x: x[1]['in_progress'], 
        reverse=True
    )[:3]
    
    # 결과 데이터 구성
    problematic_products = []
    for product_name, stats in sorted_products:
        completion_rate = (stats['completed'] / stats['total'] * 100) if stats['total'] > 0 else 0
        problematic_products.append({
            'product': product_name,
            'in_progress': stats['in_progress'],
            'completed': stats['completed'],
            'completion_rate': round(completion_rate, 1)
        })
    
    return {
        "type": "problematic_products",
        "data": problematic_products
    }


def get_most_problematic_sites(site_index: int, start_date: str, end_date: str, product_name: str) -> Dict:
    """가장 문제가 많은 Site Top 3 계산 헬퍼 함수"""
    try:
        db = DatabaseManager()
        
        # 1. Site index로 Site ID 찾기
        site_id = CUSTOMER_PROJECT_IDS[site_index]
        site_project = db.get_projects_by_ids([site_id])[0]
        
        # 2. Site의 하위 프로젝트 정보 조회
        children_ids = site_project.get('children_ids', [])
        if isinstance(children_ids, str):
            children_ids = json.loads(children_ids)
        
        sub_projects = db.get_projects_by_ids(children_ids)
        
        # 3. 각 Sub Site별로 통계 계산
        site_stats = []
        for sub_project in sub_projects:
            sub_site_name = sub_project.get('project_name')
            
            # 해당 Sub Site의 모든 Product 프로젝트 ID 가져오기
            project_ids = get_issue_project_ids(site_index, sub_site_name, product_name)
            
            # 이슈 데이터 조회
            issues = db.get_issues_by_filter(start_date, end_date, project_ids)
            
            # Sub Site별 통계 계산
            stats = get_overall_issue_status(issues)
            
            # 진행 중이거나 완료된 일감이 있는 경우만 추가
            if stats['in_progress_count'] > 0 or stats['completed_count'] > 0:
                # 툴팁 정보 생성
                tooltip_info = generate_site_tooltip(issues)
                
                site_stats.append({
                    'site': sub_site_name,
                    'in_progress': stats['in_progress_count'],
                    'completed': stats['completed_count'],
                    'completion_rate': stats['completion_rate'],
                    'tooltip': tooltip_info
                })
        
        # 4. 진행중인 일감 수로 정렬
        sorted_sites = sorted(site_stats, key=lambda x: x['in_progress'], reverse=True)
        
        return {
            "type": "problematic_sites",
            "data": sorted_sites
        }
        
    except Exception as e:
        return {
            "type": "problematic_sites",
            "data": []
        }


def generate_site_tooltip(issues: List[Dict]) -> str:
    """이슈 데이터를 받아서 Site 툴팁용 요약 텍스트를 생성하는 헬퍼 함수"""
    # 완료된 일감과 미완료 일감 분리
    completed_issues = [issue for issue in issues if issue.get('is_closed') == 1]
    in_progress_issues = [issue for issue in issues if issue.get('is_closed') == 0]
    
    # 완료된 일감 tracker_name별로 카운트
    completed_tracker_counts = {}
    for issue in completed_issues:
        tracker_name = issue.get('tracker_name', 'Unknown')
        completed_tracker_counts[tracker_name] = completed_tracker_counts.get(tracker_name, 0) + 1
    
    # 미완료 일감 tracker_name별로 카운트
    in_progress_tracker_counts = {}
    for issue in in_progress_issues:
        tracker_name = issue.get('tracker_name', 'Unknown')
        in_progress_tracker_counts[tracker_name] = in_progress_tracker_counts.get(tracker_name, 0) + 1
    
    # 미완료 일감 tracker별 개수를 1줄로 결합
    in_progress_parts = []
    
    for tracker_name, count in in_progress_tracker_counts.items():
        # 대괄호 제거하고 깔끔한 이름으로 변환
        clean_name = tracker_name.replace('[AE][이슈] ', '').replace('[AE][Setup] ', '').replace('[AE] ', '')
        # tracker별 고정 색상 매핑
        if 'HW' in clean_name:
            color = '#FF6B6B'  # 빨간색
        elif 'SW' in clean_name:
            color = '#4CAF50'  # 초록색
        elif 'AE' in clean_name:
            color = '#2196F3'  # 파란색
        else:
            color = '#FF9800'  # 주황색
        # 10건 이상이면 폰트 크기 증가
        font_size = '1.5rem' if count >= 10 else '1.1rem'
        in_progress_parts.append(f'<span style="color: {color}; font-size: {font_size}; font-weight: {"bold" if count >= 10 else "normal"}">{clean_name}: {count}건</span>')
    
    # 완료된 일감 tracker별 개수를 1줄로 결합
    completed_parts = []
    
    for tracker_name, count in completed_tracker_counts.items():
        # 대괄호 제거하고 깔끔한 이름으로 변환
        clean_name = tracker_name.replace('[AE][이슈] ', '').replace('[AE][Setup] ', '').replace('[AE] ', '')
        # tracker별 고정 색상 매핑
        if 'HW' in clean_name:
            color = '#FF6B6B'  # 빨간색
        elif 'SW' in clean_name:
            color = '#4CAF50'  # 초록색
        elif 'AE' in clean_name:
            color = '#2196F3'  # 파란색
        else:
            color = '#FF9800'  # 주황색
        # 10건 이상이면 폰트 크기 증가
        font_size = '1.5rem' if count >= 10 else '1.1rem'
        completed_parts.append(f'<span style="color: {color}; font-size: {font_size}; font-weight: {"bold" if count >= 10 else "normal"}">{clean_name}: {count}건</span>')
    
    # 미완료와 완료를 구분해서 표시
    tooltip_text = ""
    if in_progress_parts:
        tooltip_text += f'<div style="margin-bottom: 8px;"><span style="color: #FFFFFF; font-weight: bold;">미완료</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;".join(in_progress_parts) + '</div>'
    
    if completed_parts:
        tooltip_text += f'<div style="margin-bottom: 8px;"><span style="color: #FFFFFF; font-weight: bold;">완료</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;".join(completed_parts) + '</div>'
    
    # 각 tracker별 주요 작업 추가
    tooltip_text += "<br><br>"
    
    for tracker_name, count in completed_tracker_counts.items():
        clean_name = tracker_name.replace('[AE][이슈] ', '').replace('[AE][Setup] ', '').replace('[AE] ', '')
        # tracker별 고정 색상 매핑
        if 'HW' in clean_name:
            color = '#FF6B6B'  # 빨간색
        elif 'SW' in clean_name:
            color = '#4CAF50'  # 초록색
        elif 'AE' in clean_name:
            color = '#2196F3'  # 파란색
        else:
            color = '#FF9800'  # 주황색
        
        # 해당 tracker의 일감들 필터링
        tracker_issues = [issue for issue in completed_issues if issue.get('tracker_name') == tracker_name]
        
        tooltip_text += f'<div style="margin-bottom: 8px;"><span style="color: {color}; font-weight: bold; font-size: 1.1rem;">{clean_name} 주요 작업</span><br>'
        
        # 상위 3개 일감 제목 추가 (있는 것까지)
        for i, issue in enumerate(tracker_issues[:3], 1):
            subject = issue.get('subject', '제목 없음')
            tooltip_text += f'<span style="font-size: 1.1rem;">{i}. {subject}</span><br>'
        
        # 일감이 없는 경우
        if len(tracker_issues) == 0:
            tooltip_text += '<span style="font-size: 1.1rem;">완료된 일감이 없습니다.</span><br>'
        
        tooltip_text += '</div>'
    
    # 등록 인원별 Top 3 추가 (완료된 일감 기준)
    author_counts = {}
    for issue in completed_issues:
        author = issue.get('author_name', 'Unknown')
        author_counts[author] = author_counts.get(author, 0) + 1
    
    # 등록 인원별 Top 3 정렬
    top_authors = sorted(author_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    
    tooltip_text += f'<br><div style="margin-top: 8px;"><span style="color: #9C27B0; font-weight: bold; font-size: 1.1rem;">등록 인원별 Top 3 (완료)</span><br>'
    for i, (author, count) in enumerate(top_authors, 1):
        tooltip_text += f'<span style="font-size: 1.1rem;">{i}. {author}: {count}건</span><br>'
    tooltip_text += '</div>'
    
    return tooltip_text


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

@router.post("/sub-sites")
async def get_sub_sites(request: Request): # 수정 불가
    """다중 SITE 선택용 - SITE 인덱스 리스트로 Sub Site 목록 조회"""
    try:
        data = await request.json()
        site_indexes = data.get('site_indexes', [])
        
        if not site_indexes:
            return {
                "success": True,
                "projects": []
            }
        
        # 모든 SITE의 Sub Site 데이터 수집
        all_sub_sites = []
        
        for site_index in site_indexes:
            try:
                # 기존 get_sub_site 함수의 로직을 재사용
                site_id = CUSTOMER_PROJECT_IDS[site_index]
                
                db = DatabaseManager()
                project_info = db.get_projects_by_ids([site_id])
                
                if not project_info:
                    continue
                
                children_ids = project_info[0].get('children_ids', [])
                # JSON 문자열을 파싱해서 숫자 리스트로 변환
                if isinstance(children_ids, str):
                    children_ids = json.loads(children_ids)
                sub_projects = db.get_projects_by_ids(children_ids)
                
                # 각 SITE의 Sub Site 목록 추가
                for project in sub_projects:
                    project_name = project.get('project_name', '')
                    all_sub_sites.append({
                        'project_name': project_name
                    })
                        
            except Exception as e:
                print(f"SITE {site_index} 처리 중 오류: {str(e)}")
                continue
        
        # ALL을 제일 처음에 추가
        final_sub_sites = [{'project_name': 'ALL'}]
        final_sub_sites.extend(all_sub_sites)
        
        return {
            "success": True,
            "projects": final_sub_sites
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"다중 SITE Sub Site 조회 실패: {str(e)}")

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

@router.post("/product-lists")
async def get_product_lists(request: Request): # 수정 불가가
    """다중 Sub Site 선택용 - Sub Site 이름 리스트로 Product List 목록 조회"""
    try:
        data = await request.json()
        sub_site_names = data.get('sub_site_names', [])
        
        if not sub_site_names:
            return {
                "success": True,
                "product_list": []
            }
        
        # 모든 Sub Site의 Product 데이터 수집
        all_products = []
        
        for sub_site_name in sub_site_names:
            try:
                # 기존 get_product_list 함수의 로직을 재사용
                db = DatabaseManager()
                projects = db.get_projects_by_name(sub_site_name)
                
                if not projects:
                    continue
                
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
                
                # products_ids로 하위 프로젝트들의 모든 정보 조회
                final_products = db.get_projects_by_ids(products_ids)
                
                # final_products에서 레벨 4인 프로젝트들만 products에 저장
                for project in final_products:
                    level = project.get('level', 0)
                    if level == 4:
                        products.append(project)
                
                # 각 Sub Site의 Product 목록 추가
                import re
                for project in products:
                    project_name = project.get('project_name', '')
                    # "#01", "#02" 등의 패턴 앞부분 추출
                    match = re.match(r'^(.+?)\s+#\d+', project_name)
                    if match:
                        prefix = match.group(1).strip()
                        all_products.append({
                            'name': prefix
                        })
                        
            except Exception as e:
                print(f"Sub Site {sub_site_name} 처리 중 오류: {str(e)}")
                continue
        
        # 중복 제거 (같은 이름의 Product가 여러 Sub Site에 있을 수 있음)
        unique_products = []
        seen_names = set()
        
        for product in all_products:
            product_name = product.get('name', '')
            if product_name not in seen_names:
                seen_names.add(product_name)
                unique_products.append(product)
        
        # ALL을 제일 처음에 추가
        final_product_list = [{'name': 'ALL'}]
        final_product_list.extend(unique_products)
        
        return {
            "success": True,
            "product_list": final_product_list
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"다중 Sub Site Product List 조회 실패: {str(e)}")

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



@router.post("/get-summary-report")
async def get_summary_report(request: Request):
    """주간 업무보고 요약 데이터 조회 API"""
    try:
        data = await request.json()
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        site_indexes = data.get('site_indexes', [])  # 다중 SITE 지원
        sub_site_names = data.get('sub_site_names', [])  # 다중 Sub Site 지원
        product_names = data.get('product_names', [])  # 다중 Product 지원
        
        # 기존 단일 선택 호환성을 위한 처리
        if not site_indexes and data.get('site_index') is not None:
            site_indexes = [data.get('site_index')]
        if not sub_site_names and data.get('sub_site_name'):
            sub_site_names = [data.get('sub_site_name')]
        if not product_names and data.get('product_name'):
            product_names = [data.get('product_name')]
        
        if not all([start_date, end_date, site_indexes, sub_site_names, product_names]):
            raise HTTPException(status_code=400, detail="필수 파라미터가 누락되었습니다: start_date, end_date, site_indexes, sub_site_names, product_names")
        
        # 선택된 리스트들 로그 출력
        print(f"[get_summary_report] 선택된 SITE 인덱스: {site_indexes}")
        print(f"[get_summary_report] 선택된 Sub Site 이름: {sub_site_names}")
        print(f"[get_summary_report] 선택된 Product 이름: {product_names}")
        print(f"[get_summary_report] 시작일: {start_date}, 종료일: {end_date}")
        
        # 모든 선택된 항목들의 프로젝트 ID 리스트 수집
        all_project_ids = []
        
        for site_index in site_indexes:
            for sub_site_name in sub_site_names:
                for product_name in product_names:
                    # 헬퍼 함수 호출하여 프로젝트 ID 리스트 가져오기
                    project_ids = get_issue_project_ids(site_index, sub_site_name, product_name)
                    all_project_ids.extend(project_ids)
        
        # 중복 제거
        all_project_ids = list(set(all_project_ids))
        
        print(f"[get_summary_report] 수집된 프로젝트 ID 개수: {len(all_project_ids)}")
        print(f"[get_summary_report] 프로젝트 ID 목록: {all_project_ids}")
        
        # project_ids와 기간을 가지고 이슈 데이터 조회
        db = DatabaseManager()
        issues = db.get_issues_by_filter(start_date, end_date, all_project_ids)
        
        # 전체 이슈 현황 블럭 생성 (항상 포함)
        overall_status = get_overall_issue_status(issues)
        blocks = [{"type": "overall_status", "data": overall_status}]
        
        # 조건별 블럭 추가
        # if sub_site_name == "ALL":
        #    if product_name == "ALL":
                # Sub Site ALL + Product List ALL
                # 가장 문제가 많은 Site Top 3 블럭 추가
                # problematic_sites = get_most_problematic_sites(site_index, start_date, end_date, product_name)
                # blocks.append(problematic_sites)
                # 가장 문제가 많은 Product Top 3 블럭 추가
                # problematic_products = get_most_problematic_products(issues)
                # blocks.append(problematic_products)
        #        pass
        #    else:
                # Sub Site ALL + Product List 특정
                # 가장 문제가 많은 Site Top 3 블럭 추가
                # problematic_sites = get_most_problematic_sites(site_index, start_date, end_date, product_name)
                # blocks.append(problematic_sites)
        #        pass
        # else:
        #     if product_name == "ALL":
                # Sub Site 특정 + Product List ALL
                # 가장 문제가 많은 Product Top 3 블럭 추가
                # problematic_products = get_most_problematic_products(issues)
                # blocks.append(problematic_products)
        #        pass
        #    else:
                # Sub Site 특정 + Product List 특정
                # 기능 1, 기능 5 추가
        #        pass
        
        # 다중 선택 조건별 블럭 추가
        # Sub Site가 "ALL"이거나 여러개가 선택된 경우
        has_multiple_sub_sites = "ALL" in sub_site_names or len(sub_site_names) > 1
        
        # Product List가 "ALL"이거나 여러개가 선택된 경우
        has_multiple_products = "ALL" in product_names or len(product_names) > 1
        
        if has_multiple_sub_sites:
            if has_multiple_products:
                # 조건 1: Sub Site ALL/다중 + Product ALL/다중
                pass
            else:
                # 조건 2: Sub Site ALL/다중 + Product 한개
                pass
        else:
            if has_multiple_products:
                # 조건 3: Sub Site 한개 + Product ALL/다중
                pass
            else:
                # 조건 4: Sub Site 한개 + Product 한개
                pass
        
        return {
            "success": True,
            "data": {
                "blocks": blocks
            }
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"주간 업무보고 데이터 조회 실패: {str(e)}") 


@router.post("/get-progress-data")
async def get_progress_data(request: Request):
    """진행율 데이터 조회 API"""
    try:
        data = await request.json()
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        site_indexes = data.get('site_indexes', [])
        sub_site_names = data.get('sub_site_names', [])
        product_names = data.get('product_names', [])

        # 기존 단일 선택 호환성을 위한 처리
        if not site_indexes and data.get('site_index') is not None:
            site_indexes = [data.get('site_index')]
        if not sub_site_names and data.get('sub_site_name'):
            sub_site_names = [data.get('sub_site_name')]
        if not product_names and data.get('product_name'):
            product_names = [data.get('product_name')]

        if not all([start_date, end_date, site_indexes, sub_site_names, product_names]):
            raise HTTPException(status_code=400, detail="필수 파라미터가 누락되었습니다: start_date, end_date, site_indexes, sub_site_names, product_names")

        # TODO: 진행율 데이터 로직 구현
        pass

        return {
            "success": True,
            "data": {}
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"진행율 데이터 조회 실패: {str(e)}")


@router.post("/get-type-data")
async def get_type_data(request: Request):
    """유형 데이터 조회 API"""
    try:
        data = await request.json()
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        site_indexes = data.get('site_indexes', [])
        sub_site_names = data.get('sub_site_names', [])
        product_names = data.get('product_names', [])

        # 기존 단일 선택 호환성을 위한 처리
        if not site_indexes and data.get('site_index') is not None:
            site_indexes = [data.get('site_index')]
        if not sub_site_names and data.get('sub_site_name'):
            sub_site_names = [data.get('sub_site_name')]
        if not product_names and data.get('product_name'):
            product_names = [data.get('product_name')]

        if not all([start_date, end_date, site_indexes, sub_site_names, product_names]):
            raise HTTPException(status_code=400, detail="필수 파라미터가 누락되었습니다: start_date, end_date, site_indexes, sub_site_names, product_names")

        # TODO: 유형 데이터 로직 구현
        pass

        return {
            "success": True,
            "data": {}
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"유형 데이터 조회 실패: {str(e)}")


@router.post("/get-member-data")
async def get_member_data(request: Request):
    """인원 데이터 조회 API"""
    try:
        data = await request.json()
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        site_indexes = data.get('site_indexes', [])
        sub_site_names = data.get('sub_site_names', [])
        product_names = data.get('product_names', [])

        # 기존 단일 선택 호환성을 위한 처리
        if not site_indexes and data.get('site_index') is not None:
            site_indexes = [data.get('site_index')]
        if not sub_site_names and data.get('sub_site_name'):
            sub_site_names = [data.get('sub_site_name')]
        if not product_names and data.get('product_name'):
            product_names = [data.get('product_name')]

        if not all([start_date, end_date, site_indexes, sub_site_names, product_names]):
            raise HTTPException(status_code=400, detail="필수 파라미터가 누락되었습니다: start_date, end_date, site_indexes, sub_site_names, product_names")

        # TODO: 인원 데이터 로직 구현
        pass

        return {
            "success": True,
            "data": {}
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"인원 데이터 조회 실패: {str(e)}")


@router.post("/get-hw-data")
async def get_hw_data(request: Request):
    """HW 데이터 조회 API"""
    try:
        data = await request.json()
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        site_indexes = data.get('site_indexes', [])
        sub_site_names = data.get('sub_site_names', [])
        product_names = data.get('product_names', [])

        # 기존 단일 선택 호환성을 위한 처리
        if not site_indexes and data.get('site_index') is not None:
            site_indexes = [data.get('site_index')]
        if not sub_site_names and data.get('sub_site_name'):
            sub_site_names = [data.get('sub_site_name')]
        if not product_names and data.get('product_name'):
            product_names = [data.get('product_name')]

        if not all([start_date, end_date, site_indexes, sub_site_names, product_names]):
            raise HTTPException(status_code=400, detail="필수 파라미터가 누락되었습니다: start_date, end_date, site_indexes, sub_site_names, product_names")

        # TODO: HW 데이터 로직 구현
        pass

        return {
            "success": True,
            "data": {}
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HW 데이터 조회 실패: {str(e)}")


@router.post("/get-sw-data")
async def get_sw_data(request: Request):
    """SW 데이터 조회 API"""
    try:
        data = await request.json()
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        site_indexes = data.get('site_indexes', [])
        sub_site_names = data.get('sub_site_names', [])
        product_names = data.get('product_names', [])

        # 기존 단일 선택 호환성을 위한 처리
        if not site_indexes and data.get('site_index') is not None:
            site_indexes = [data.get('site_index')]
        if not sub_site_names and data.get('sub_site_name'):
            sub_site_names = [data.get('sub_site_name')]
        if not product_names and data.get('product_name'):
            product_names = [data.get('product_name')]

        if not all([start_date, end_date, site_indexes, sub_site_names, product_names]):
            raise HTTPException(status_code=400, detail="필수 파라미터가 누락되었습니다: start_date, end_date, site_indexes, sub_site_names, product_names")

        # TODO: SW 데이터 로직 구현
        pass

        return {
            "success": True,
            "data": {}
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SW 데이터 조회 실패: {str(e)}")

