"""
FAP 2.0 - 메인 페이지 데이터 API 라우터 (백엔드)

주요 기능:
- 로드맵 대시보드: 프로젝트별 로드맵 데이터 조회 및 처리
- 위키 페이지: Redmine 위키 페이지 내용 및 첨부파일 조회
- 이슈 분석: 연결된 이슈들의 통계 및 상세 정보 처리
- 이미지 프록시: Redmine 첨부파일 이미지를 Base64로 변환

API 엔드포인트:
- /roadmap-dashboard: 로드맵 대시보드 데이터 조회
- /wiki-content: 위키 페이지 내용 조회
- /attachment-image/{id}: 첨부파일 이미지 Base64 변환

기술 스택:
- FastAPI
- MariaDB (DatabaseManager)
- Redmine API
- Base64 인코딩

데이터 흐름:
1. 프론트엔드에서 API 요청
2. DatabaseManager를 통한 DB 작업
3. Redmine API 연동 (위키, 첨부파일)
4. 데이터 가공 및 반환
"""

from fastapi import APIRouter, HTTPException, Request, Query
from typing import Dict, List, Optional
from db_manager import DatabaseManager
import requests
from config import REDMINE_URL, API_KEY

def get_type_data_list(issues: List[Dict]) -> Dict: # 수정 불가
    """이슈 데이터를 받아서 유형별 상세 리스트를 생성하는 헬퍼 함수"""
    
    # tracker_name별로 이슈들을 그룹화
    tracker_groups = {}
    
    for issue in issues:
        tracker_name = issue.get('tracker_name', 'Unknown')
        # tracker_name별 그룹화
        if tracker_name not in tracker_groups:
            tracker_groups[tracker_name] = []
        tracker_groups[tracker_name].append(issue)
    
    # 각 tracker별로 상세 정보 구성
    type_list = []
    
    for tracker_name, issue_list in tracker_groups.items():
        # 완료/미완료 분리
        completed_issues = [issue for issue in issue_list if issue.get('is_closed') == 1]
        in_progress_issues = [issue for issue in issue_list if issue.get('is_closed') == 0]
        
        # 통계 계산
        total_count = len(issue_list)
        completed_count = len(completed_issues)
        in_progress_count = len(in_progress_issues)
        completion_rate = (completed_count / total_count * 100) if total_count > 0 else 0
        
        # Product별 통계 계산 및 제목 수집
        product_stats = {}
        product_titles = {}
        product_closed_status = {}
        product_issue_numbers = {}
        product_descriptions = {}
        product_members = {}
        for issue in issue_list:
            product = issue.get('product', 'Unknown')
            is_closed = issue.get('is_closed', 0)
            subject = issue.get('subject', '제목 없음')
            description = issue.get('description', '')
            redmine_id = issue.get('redmine_id', 0)
            assigned_to = issue.get('author_name', 'Unknown')
            
            if product not in product_stats:
                product_stats[product] = {
                    'total': 0,
                    'completed': 0,
                    'in_progress': 0
                }
                product_titles[product] = []
                product_closed_status[product] = []
                product_issue_numbers[product] = []
                product_descriptions[product] = []
                product_members[product] = {}
            
            product_stats[product]['total'] += 1
            product_titles[product].append(subject)
            product_closed_status[product].append(is_closed)
            product_issue_numbers[product].append(redmine_id)
            product_descriptions[product].append(description)
            
            # 인원별 통계 추가
            if assigned_to not in product_members[product]:
                product_members[product][assigned_to] = {
                    'total': 0,
                    'completed': 0,
                    'in_progress': 0,
                    'issues': []
                }
            
            product_members[product][assigned_to]['total'] += 1
            product_members[product][assigned_to]['issues'].append({
                'subject': subject,
                'redmine_id': redmine_id,
                'is_closed': is_closed,
                'description': description
            })
            
            if is_closed == 1:
                product_stats[product]['completed'] += 1
                product_members[product][assigned_to]['completed'] += 1
            else:
                product_stats[product]['in_progress'] += 1
                product_members[product][assigned_to]['in_progress'] += 1
        
        # Product별 완료율 계산
        product_details = []
        for product, stats in product_stats.items():
            product_completion_rate = (stats['completed'] / stats['total'] * 100) if stats['total'] > 0 else 0
            
            # 인원별 정보 정리
            member_details = []
            for member_name, member_stats in product_members[product].items():
                member_completion_rate = (member_stats['completed'] / member_stats['total'] * 100) if member_stats['total'] > 0 else 0
                member_details.append({
                    'member_name': member_name,
                    'total_count': member_stats['total'],
                    'completed_count': member_stats['completed'],
                    'in_progress_count': member_stats['in_progress'],
                    'completion_rate': round(member_completion_rate, 1),
                    'issues': member_stats['issues']
                })
            
            # 인원별 총 건수로 정렬 (내림차순)
            member_details.sort(key=lambda x: x['total_count'], reverse=True)
            
            product_details.append({
                'product_name': product,
                'total_count': stats['total'],
                'completed_count': stats['completed'],
                'in_progress_count': stats['in_progress'],
                'completion_rate': round(product_completion_rate, 1),
                'issue_titles': product_titles[product],
                'issue_closed_status': product_closed_status[product],
                'issue_numbers': product_issue_numbers[product],
                'issue_descriptions': product_descriptions[product],
                'member_details': member_details
            })
        
        # Product별 완료율로 정렬 (내림차순)
        product_details.sort(key=lambda x: x['completion_rate'], reverse=True)
        
        type_list.append({
            "tracker_name": tracker_name,
            "total_count": total_count,
            "completed_count": completed_count,
            "in_progress_count": in_progress_count,
            "completion_rate": round(completion_rate, 1),
            "product_details": product_details
            
        })
    
    # 총 건수로 정렬 (내림차순)
    type_list.sort(key=lambda x: x['total_count'], reverse=True)
    
    return {
        "type_list": type_list
    }

router = APIRouter(prefix="/api/main", tags=["main"])



def get_open_roadmap_block() -> Dict:
    """DB에서 status가 Open인 항목의 모든 데이터를 개별 변수로 저장해서 리턴한다"""
    try:
        db = DatabaseManager()
        open_roadmap = db.get_roadmap_by_status("open")
        
        # status가 Open인 항목을 project_name별로 묶어서 저장
        open_roadmap_by_project = {}
        for item in open_roadmap.get("data", []):
            # 각 필드를 개별 변수로 저장
            id = item.get("id")
            redmine_version_id = item.get("redmine_version_id")
            project_id = item.get("project_id")
            project_name = item.get("project_name")
            # project_name에서 첫 번째 단어(숫자. 형태) 제거
            if project_name and "." in project_name:
                parts = project_name.split(".", 1)
                if len(parts) > 1 and parts[0].strip().isdigit():
                    project_name = parts[1].strip()
            version_name = item.get("version_name")
            status = item.get("status")
            description = item.get("description")
            due_date = item.get("due_date")
            created_on = item.get("created_on")
            updated_on = item.get("updated_on")
            wiki_page_title = item.get("wiki_page_title")
            wiki_page_url = item.get("wiki_page_url")
            connected_issue_ids = item.get("connected_issue_ids")
            created_at = item.get("created_at")
            updated_at = item.get("updated_at")
            
            # 연결된 일감들의 상세 정보 가져오기
            connected_issues_detail = []
            connected_issues_analysis = {}
            if connected_issue_ids:
                # ID만 추출해서 리스트로 만들기
                issue_ids = [int(issue_id.strip()) for issue_id in connected_issue_ids.split(',') if issue_id.strip()]
                if issue_ids:
                    # 각 ID별로 get_issue_by_id로 데이터 가져오기
                    for issue_id in issue_ids:
                        issue_detail = db.get_issue_by_id(issue_id)
                        if issue_detail:
                            connected_issues_detail.append(issue_detail)
                    
                    # 분류된 정보 가져오기
                    if connected_issues_detail:
                        connected_issues_analysis = get_type_data_list(connected_issues_detail)
            
            # project_name별로 그룹화
            if project_name not in open_roadmap_by_project:
                open_roadmap_by_project[project_name] = []
            
            open_roadmap_by_project[project_name].append({
                "id": id,
                "redmine_version_id": redmine_version_id,
                "project_id": project_id,
                "project_name": project_name,
                "version_name": version_name,
                "status": status,
                "description": description,
                "due_date": due_date,
                "created_on": created_on,
                "updated_on": updated_on,
                "wiki_page_title": wiki_page_title,
                "wiki_page_url": wiki_page_url,
                "connected_issue_ids": connected_issue_ids,
                "connected_issues_detail": connected_issues_detail,
                "connected_issues_analysis": connected_issues_analysis,
                "created_at": created_at,
                "updated_at": updated_at
            })
        
        return open_roadmap_by_project
        
    except Exception as e:
        return {
            "success": False,
            "data": [],
            "count": 0,
            "message": f"블록 처리 중 오류: {str(e)}"
        }

@router.get("/roadmap-dashboard")
async def get_roadmap_dashboard():
    """메인 페이지용 로드맵 대시보드 데이터 조회"""
    try:
        open_roadmap_block = get_open_roadmap_block()
        
        return {
            "success": True,
            "message": "로드맵 대시보드 데이터 조회 완료",
            "data": {
                "open_roadmap": open_roadmap_block
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"로드맵 대시보드 데이터 조회 실패: {str(e)}",
            "data": {}
        }

def get_wiki_content(wiki_url: str) -> Dict:
    """위키 URL에서 내용을 가져오는 함수"""
    try:
        import re
        
        # URL에서 프로젝트명과 페이지명 추출
        pattern = r'/projects/([^/]+)/wiki/([^/?]+)'
        match = re.search(pattern, wiki_url)
        
        if not match:
            return {
                "success": False,
                "message": "위키 URL 형식이 올바르지 않습니다",
                "content": ""
            }
        
        project_name = match.group(1)
        page_name = match.group(2)
        
        # 레드마인 API 호출 (첨부파일 포함)
        api_url = f"{REDMINE_URL}/projects/{project_name}/wiki/{page_name}.json?include=attachments"
        headers = {
            'X-Redmine-API-Key': API_KEY,
            'Content-Type': 'application/json'
        }
        
        response = requests.get(api_url, headers=headers)
        
        if response.status_code == 200:
            wiki_data = response.json()
            wiki_page = wiki_data.get('wiki_page', {})
            content = wiki_page.get('text', '')
            
            # 첨부파일 정보 가져오기
            attachments = wiki_page.get('attachments', [])
            attachment_info = []
            
            for attachment in attachments:
                attachment_info.append({
                    "id": attachment.get('id'),
                    "filename": attachment.get('filename'),
                    "content_type": attachment.get('content_type'),
                    "filesize": attachment.get('filesize'),
                    "download_url": f"{REDMINE_URL}/attachments/download/{attachment.get('id')}/{attachment.get('filename')}",
                    "direct_url": f"{REDMINE_URL}/attachments/download/{attachment.get('id')}/{attachment.get('filename')}"
                })
            
            return {
                "success": True,
                "message": "위키 내용 조회 완료",
                "content": content,
                "title": wiki_page.get('title', ''),
                "version": wiki_page.get('version', 1),
                "attachments": attachment_info
            }
        else:
            return {
                "success": False,
                "message": f"위키 내용 조회 실패: {response.status_code}",
                "content": ""
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"위키 내용 조회 중 오류: {str(e)}",
            "content": ""
        }

@router.get("/wiki-content")
async def get_wiki_content_api(wiki_url: str = Query(..., description="위키 페이지 URL")):
    """위키 페이지 내용 조회 API"""
    try:
        wiki_content = get_wiki_content(wiki_url)
        
        return {
            "success": wiki_content["success"],
            "message": wiki_content["message"],
            "data": {
                "content": wiki_content["content"],
                "title": wiki_content.get("title", ""),
                "version": wiki_content.get("version", 1),
                "attachments": wiki_content.get("attachments", [])
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"위키 내용 조회 실패: {str(e)}",
            "data": {
                "content": "",
                "title": "",
                "version": 1
            }
        }

@router.get("/attachment-image/{attachment_id}")
async def get_attachment_image(attachment_id: int):
    """첨부파일 이미지를 Base64로 인코딩해서 반환하는 API"""
    try:
        # 레드마인에서 이미지 다운로드
        download_url = f"{REDMINE_URL}/attachments/download/{attachment_id}"
        headers = {"X-Redmine-API-Key": API_KEY}
        
        response = requests.get(download_url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            # 이미지를 Base64로 인코딩
            import base64
            image_base64 = base64.b64encode(response.content).decode('utf-8')
            
            # Content-Type 확인
            content_type = response.headers.get('content-type', 'image/png')
            
            return {
                "success": True,
                "message": "이미지 로드 성공",
                "data": {
                    "image_base64": image_base64,
                    "content_type": content_type,
                    "data_url": f"data:{content_type};base64,{image_base64}"
                }
            }
        else:
            return {
                "success": False,
                "message": f"이미지 다운로드 실패: {response.status_code}",
                "data": {}
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"이미지 로드 중 오류: {str(e)}",
            "data": {}
        }
