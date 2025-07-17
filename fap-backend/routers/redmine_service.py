# routers/redmine_service.py
from fastapi import APIRouter
import requests
from fastapi import HTTPException
from config import REDMINE_URL, API_KEY as REDMINE_API_KEY
from fastapi import Request
from fastapi.responses import FileResponse
import shutil
import os

# 전역 캐시 딕셔너리 선언 (파일 상단에 위치해야 함)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def fetch_redmine_issue(issue_id: int):  # 수정 불가
    """
    Redmine에서 이슈 전체 정보를 받아오는 헬퍼 함수
    """
    url = f"{REDMINE_URL}/issues/{issue_id}.json"
    headers = {"X-Redmine-API-Key": REDMINE_API_KEY}
    resp = requests.get(url, headers=headers, timeout=10)
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

@router.get('/make-report-download')
def make_report_download():  
    """
    엑셀 템플릿 파일(templates/Report.xlsx)을 복사해서 사용자에게 반환
    (아직 데이터 채우기 없이 파일 복사만)
    """
    template_path = os.path.join(os.path.dirname(__file__), '../templates/Report.xlsx')
    temp_copy_path = os.path.join(os.path.dirname(__file__), '../templates/Report_temp.xlsx')
    shutil.copyfile(template_path, temp_copy_path)
    return FileResponse(temp_copy_path, filename='Report.xlsx', media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') 