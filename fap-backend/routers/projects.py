# routers/projects.py
from fastapi import APIRouter
from typing import List, Optional
from pydantic import BaseModel
from fastapi import Path, Query
import requests
from fastapi import HTTPException
from config import REDMINE_URL, API_KEY as REDMINE_API_KEY

router = APIRouter(prefix="/api/projects", tags=["projects"])

class Project(BaseModel):
    id: int
    name: str

_projects = [
    Project(id=1, name="Project A"),
    Project(id=2, name="Project B"),
]

@router.get("/", response_model=List[Project])
async def list_projects():
    return _projects

@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: int):
    project = next((p for p in _projects if p.id == project_id), None)
    if not project:
        return {"error": "Project not found"}
    return project

@router.get('/{project_id}/detail')
def get_project_detail(project_id: int = Path(...)):
    """
    프로젝트 ID로 Redmine에서 프로젝트 상세 정보를 조회하여 반환
    (부모 프로젝트, 부모의 부모 정보까지 포함)
    """
    url = f"{REDMINE_URL}/projects/{project_id}.json?include=parent"
    headers = {"X-Redmine-API-Key": REDMINE_API_KEY}
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    data = resp.json().get('project', {})
    location = data.get('parent', {}).get('name') if data.get('parent') else None
    site = None
    # 부모가 있으면 부모의 부모도 조회
    if data.get('parent') and data['parent'].get('id'):
        parent_id = data['parent']['id']
        parent_url = f"{REDMINE_URL}/projects/{parent_id}.json?include=parent"
        parent_resp = requests.get(parent_url, headers=headers, timeout=10)
        if parent_resp.status_code == 200:
            parent_data = parent_resp.json().get('project', {})
            site = parent_data.get('parent', {}).get('name') if parent_data.get('parent') else None
    data['location'] = location
    data['site'] = site
    return data

@router.get('/{project_id}/parent-log')
def log_parent_project(project_id: int = Path(...)):
    """
    프로젝트 ID로 Redmine에서 프로젝트 상세 정보를 조회하고,
    부모 프로젝트 정보(있으면)를 서버 로그에 출력
    """
    url = f"{REDMINE_URL}/projects/{project_id}.json?include=parent"
    headers = {"X-Redmine-API-Key": REDMINE_API_KEY}
    resp = requests.get(url, headers=headers, timeout=10)
    print(f"[Redmine 응답] status={resp.status_code}, text={resp.text}")
    if resp.status_code != 200:
        return {"error": f"Redmine API error: {resp.status_code}"}
    data = resp.json().get('project', {})
    parent = data.get('parent')
    if parent:
        print(f"[부모 프로젝트] id={parent.get('id')}, name={parent.get('name')}")
        return {"parent": parent}
    else:
        print("[부모 프로젝트] 부모 없음")
        return {"parent": None}

@router.get('/redmine-issues')
def get_redmine_issues(limit: int = 10, offset: int = 0):
    """
    Redmine에서 전체 일감(이슈) 리스트를 조회하는 단순 API
    """
    url = f"{REDMINE_URL}/issues.json"
    headers = {"X-Redmine-API-Key": REDMINE_API_KEY}
    params = {"limit": limit, "offset": offset}
    resp = requests.get(url, headers=headers, params=params)
    if resp.status_code == 200:
        return resp.json().get("issues", [])
    else:
        return []

@router.get('/log-latest-issue')
def log_latest_issue():
    """
    Redmine에서 가장 최근 일감(이슈) 하나의 정보를 받아와 서버 로그에 출력
    """
    url = f"{REDMINE_URL}/issues.json?limit=1&offset=0&sort=id:desc"
    headers = {"X-Redmine-API-Key": REDMINE_API_KEY}
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code == 200:
        issues = resp.json().get("issues", [])
        if issues:
            print("[가장 최근 일감]", issues[0])
    else:
        print(f"[Redmine 일감 조회 실패] status={resp.status_code}, text={resp.text}")
    return {"success": True}

@router.get('/redmine-issue/{issue_id}')
def get_redmine_issue(issue_id: int):
    """
    Redmine에서 단일 일감(이슈) 정보를 받아오는 API
    """
    url = f"{REDMINE_URL}/issues/{issue_id}.json"
    headers = {"X-Redmine-API-Key": REDMINE_API_KEY}
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code == 200:
        return resp.json()
    else:
        return {"error": f"Redmine API error: {resp.status_code}"}
