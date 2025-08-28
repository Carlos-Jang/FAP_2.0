"""
FAP 2.0 - 레드마인 실시간 서비스 API 라우터 (백엔드)

주요 기능:
- 실시간 데이터 조회: 레드마인에서 즉시 데이터 가져오기
- 실시간 데이터 업데이트: 레드마인에 즉시 데이터 변경 반영
- 이슈 상태 실시간 업데이트: 드래그 앤 드롭으로 즉시 상태 변경
- AE Make Report 관련 API: 보고서 생성 및 엑셀 다운로드

API 엔드포인트:
- /find-report: 보고서 검색 (실시간 레드마인 조회)
- /find-five-report: 5개 보고서 검색
- /get-site: 사이트 정보 조회
- /make-report-download: 엑셀 템플릿 다운로드

헬퍼 함수:
- fetch_redmine_issue(): 특정 이슈 실시간 조회
- get_parent_issue_id(): 부모 이슈 ID 실시간 조회
- get_project_name(): 프로젝트 이름 실시간 조회
- update_issue_status(): 이슈 상태 실시간 업데이트

기술 스택:
- FastAPI
- Redmine API
- 실시간 데이터 처리
"""

# redmine_service.py
from fastapi import APIRouter
import requests
from fastapi import HTTPException
from config import REDMINE_URL, API_KEY as REDMINE_API_KEY
from fastapi import Request
from fastapi.responses import FileResponse
import shutil
import os
from typing import List, Dict

# 전역 캐시 딕셔너리 선언 (파일 상단에 위치해야 함)

router = APIRouter(prefix="/api/projects", tags=["projects"])

# ===== Redmine 관련 메서드들 PMS to FAP =====

def fetch_redmine_issue(issue_id: int):  # 수정 불가
    """
    Redmine에서 이슈 전체 정보를 받아오는 헬퍼 함수
    """
    url = f"{REDMINE_URL}/issues/{issue_id}.json?key={REDMINE_API_KEY}"
    resp = requests.get(url, timeout=10)
    if resp.status_code == 200:
        return resp.json().get("issue", {})
    else:
        return None

def get_parent_issue_id(project_id: int):  # 수정 불가
    """
    project_id로 Redmine에서 프로젝트 정보를 받아와 부모 일감 ID를 반환하는 헬퍼 함수
    """
    url = f"{REDMINE_URL}/projects/{project_id}.json"
    headers = {"X-Redmine-API-Key": REDMINE_API_KEY}
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code == 200:
        project = resp.json().get("project", {})
        parent = project.get('parent', {})
        if parent:
            return parent.get('id')
    return None

def get_project_name(project_id: int):  # 수정 불가
    """
    project_id로 Redmine에서 프로젝트 정보를 받아와 프로젝트 이름을 반환하는 헬퍼 함수
    """
    url = f"{REDMINE_URL}/projects/{project_id}.json"
    headers = {"X-Redmine-API-Key": REDMINE_API_KEY}
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code == 200:
        project = resp.json().get("project", {})
        return project.get('name', '')
    return None

def fetch_redmine_issues(limit: int = 50, offset: int = 0) -> List[Dict]:
    """
    Redmine에서 일괄 조회로 일감들을 가져오는 함수
    필터링 없이 최근 일감들을 반환
    
    Args:
        limit (int): 가져올 일감 개수 (기본값: 50, 최대: 100)
        offset (int): 시작 위치 (페이지네이션용, 기본값: 0)
    
    Returns:
        List[Dict]: 일감 데이터 리스트
    """
    try:
        url = f"{REDMINE_URL}/issues.json"
        params = {
            "key": REDMINE_API_KEY,
            "limit": min(limit, 100),  # 최대 100개로 제한
            "offset": offset,  # 페이지네이션용 시작 위치
            "sort": "created_on:desc",  # 최신순 정렬
            "status_id": "*"  # 모든 상태의 일감 가져오기 (완료, 진행중 모두)
        }
        
        response = requests.get(url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            issues = data.get("issues", [])
            
            # FAP 형식으로 변환
            formatted_issues = []
            for issue in issues:
                # Project 정보
                project = issue.get('project', {})
                project_name = project.get('name', '')
                
                formatted_issue = {
                    "redmine_id": issue.get("id"),
                    "subject": issue.get("subject", ""),
                    "description": issue.get("description", ""),
                    "status_name": issue.get("status", {}).get("name", ""),
                    "tracker_name": issue.get("tracker", {}).get("name", ""),
                    "author_name": issue.get("author", {}).get("name", ""),
                    "assigned_to_name": issue.get("assigned_to", {}).get("name", ""),
                    "created_at": issue.get("created_on", ""),
                    "updated_at": issue.get("updated_on", ""),
                    "is_closed": 1 if issue.get("status", {}).get("is_closed", False) else 0,
                    "product": [],  # Redmine에는 product 정보가 없으므로 빈 배열
                    "project_name": project_name
                }
                formatted_issues.append(formatted_issue)
            
            return formatted_issues
        else:
            print(f"Redmine API 호출 실패: {response.status_code}")
            return []
            
    except Exception as e:
        print(f"fetch_redmine_issues 오류: {str(e)}")
        return []

# ===== Redmine 관련 메서드들 FAP to PMS =====

def update_issue_status(issue_id: int, old_status_name: str, new_status_name: str, api_key: str) -> dict: # 수정 불가
    """
    Redmine에서 이슈 상태를 업데이트하는 함수
    사용자의 개인 API 키를 사용하여 상태 변경
    """
    try:
        # 1. 레드마인에서 일감 번호로 일감 정보를 가져온다
        url = f"{REDMINE_URL}/issues/{issue_id}.json"
        headers = {"X-Redmine-API-Key": api_key}
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return {
                "success": False,
                "message": f"이슈 #{issue_id} 정보를 가져올 수 없습니다. (상태 코드: {response.status_code})"
            }
        
        issue_data = response.json().get("issue", {})
        current_status_name = issue_data.get("status", {}).get("name", "")
        

        
        # 2. 일감 정보에 status_name이 올드 네임인지 확인한다
        if current_status_name != old_status_name:
            return {
                "success": False,
                "message": f"이슈 #{issue_id}의 현재 상태가 일치하지 않습니다. 현재: {current_status_name}, 예상: {old_status_name}"
            }
        
        # 3. 상태명을 status_id로 변환
        from db_manager import DatabaseManager
        db = DatabaseManager()
        status_result = db.get_status_id_by_name(new_status_name)
        
        if not status_result.get("success"):
            return {
                "success": False,
                "message": f"상태명 '{new_status_name}'에 해당하는 ID를 찾을 수 없습니다."
            }
        
        new_status_id = status_result["data"]["status_id"]

        
        # 4. Redmine API 호출하여 이슈 상태 업데이트 (status_id 사용)
        update_headers = {
            "X-Redmine-API-Key": api_key,
            "Content-Type": "application/json"
        }
        
        update_data = {
            "issue": {
                "status_id": new_status_id
            }
        }
        

        
        update_response = requests.put(url, headers=update_headers, json=update_data, timeout=10)
        

        
        if update_response.status_code == 204:  # Redmine 성공 응답
            return {
                "success": True,
                "message": f"이슈 #{issue_id} 상태가 성공적으로 변경되었습니다: {old_status_name} → {new_status_name}",
                "data": {
                    "issue_id": issue_id,
                    "old_status": old_status_name,
                    "new_status": new_status_name,
                    "new_status_id": new_status_id
                }
            }
        else:
            # 변경이 안되면 권한이 없습니다 리턴
            return {
                "success": False,
                "message": "권한이 없습니다."
            }
            
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "message": f"Redmine API 연결 오류: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"이슈 상태 업데이트 중 오류 발생: {str(e)}"
        }

# ===== Router API AE Make Report 관련 =====
@router.post('/find-report')
async def find_report(request: Request):  # 수정 불가
    """
    Find Report: issue_id가 있으면 단일 이슈 전체 정보만 리턴
    """
    data = await request.json() if request.method == 'POST' else request.query_params
    issue_id = int(data.get('issue_id', 0))
    if issue_id:
        issue = fetch_redmine_issue(issue_id)
        if issue:
            return {"issues": [issue]}
        else:
            return {"issues": []}
    else:
        return {"issues": []}

@router.post('/find-five-report')
async def find_five_report(request: Request):  # 수정 불가
    """
    Find Five Report: author_name을 받아 offset을 사용해 3개가 찰 때까지 100개씩 최대 5번(총 500개) Redmine에서 이슈를 받아오고, 작성자가 일치하는 이슈만 detailed_issues에 추가하여 3개가 되면 리턴.
    병렬처리로 성능 개선.
    """
    data = await request.json() if request.method == 'POST' else request.query_params
    author_name = data.get('author_name', None)
    if not author_name:
        return {"issues": []}
    import requests
    from concurrent.futures import ThreadPoolExecutor, as_completed
    detailed_issues = []
    offset = 0
    while len(detailed_issues) < 3 and offset < 500:
        url = f"{REDMINE_URL}/issues.json?limit=100&offset={offset}&sort=id:desc"
        headers = {"X-Redmine-API-Key": REDMINE_API_KEY}
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            break
        issues = resp.json().get("issues", [])
        if not issues:
            break
        # 작성자가 일치하는 이슈들만 필터링
        matching_issues = [i for i in issues if i.get('author', {}).get('name') == author_name]
        if matching_issues:
            # 병렬로 상세 정보 가져오기
            with ThreadPoolExecutor(max_workers=10) as executor:
                future_to_issue = {executor.submit(fetch_redmine_issue, issue['id']): issue for issue in matching_issues}
                for future in as_completed(future_to_issue):
                    detail = future.result()
                    if detail:
                        detailed_issues.append(detail)
                        if len(detailed_issues) == 3:
                            break
        offset += 100
    return {"issues": detailed_issues}

@router.post('/get-site')
async def get_site(request: Request):  # 수정 불가
    """
    project_id를 받아 1번 부모 타고 올라가서 location, 1번 더 부모 타고 올라가서 site를 반환
    """
    data = await request.json() if request.method == 'POST' else request.query_params
    project_id = int(data.get('project_id', 0))
    if not project_id:
        return {"site": None, "location": None}
    parent1 = get_parent_issue_id(project_id)
    location = get_project_name(parent1) if parent1 else None
    parent2 = get_parent_issue_id(parent1) if parent1 else None
    site = get_project_name(parent2) if parent2 else None
    return {"site": site, "location": location}

# ===== 미사용 TEST 코드 =====
@router.get('/make-report-download')
def make_report_download():  
    """
    엑셀 템플릿 파일(templates/Report.xlsx)을 복사해서 사용자에게 반환
    (아직 데이터 채우기 없이 파일 복사만)
    """
    template_path = os.path.join(os.path.dirname(__file__), 'templates/Report.xlsx')
    temp_copy_path = os.path.join(os.path.dirname(__file__), 'templates/Report_temp.xlsx')
    shutil.copyfile(template_path, temp_copy_path)
    return FileResponse(temp_copy_path, filename='Report.xlsx', media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
