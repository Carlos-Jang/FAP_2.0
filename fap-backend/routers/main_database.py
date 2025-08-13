"""
FAP 2.0 - 메인 페이지 데이터 API 라우터 (백엔드)

핵심 역할:
- FAP 2.0의 메인 페이지 데이터 관리를 담당하는 중앙 제어소
- 메인 페이지에서 필요한 모든 데이터 조회 및 관리
- 대시보드 통계 및 요약 정보 제공
- 메인 페이지 기능별 데이터 처리

주요 기능:
- 대시보드 통계: 전체 이슈, 프로젝트, 사용자 통계 정보
- 최근 활동: 최근 생성/수정된 이슈 및 프로젝트 목록
- 사용자 정보: 현재 로그인한 사용자의 정보 및 권한
- 시스템 상태: 레드마인 연동 상태 및 데이터베이스 상태
- 빠른 액세스: 자주 사용되는 기능에 대한 빠른 접근 데이터

API 엔드포인트:
- /dashboard-stats: 대시보드 통계 정보 조회
- /recent-activities: 최근 활동 목록 조회
- /user-info: 현재 사용자 정보 조회
- /system-status: 시스템 상태 정보 조회
- /quick-access: 빠른 액세스 데이터 조회

데이터 흐름:
1. 프론트엔드(MainPage)에서 메인 페이지 데이터 요청 수신
2. 사용자 인증 및 권한 검증
3. DatabaseManager를 통한 DB 작업 수행
4. 필요한 경우 레드마인 API와 연동
5. 메인 페이지용 데이터 포맷으로 결과 반환

특징:
- 대시보드 중심: 메인 페이지 대시보드에 필요한 모든 데이터 제공
- 실시간 정보: 최신 통계 및 활동 정보 제공
- 사용자 맞춤: 개인별 맞춤 정보 및 권한 기반 데이터 제공
- 성능 최적화: 메인 페이지 로딩 속도를 고려한 효율적인 데이터 조회
"""

from fastapi import APIRouter, HTTPException, Request, Query
from typing import Dict, List, Optional
from db_manager import DatabaseManager
import requests
from config import REDMINE_URL, API_KEY

router = APIRouter(prefix="/api/main", tags=["main"])

@router.get("/test-connected-issues")
async def test_connected_issues():
    """로드맵에 연결된 하위 일감들 불러오기 테스트"""
    try:
        # 삼성전자 프로젝트의 버전 정보 먼저 가져오기
        versions_url = f"{REDMINE_URL}/projects/samsung/versions.json"
        headers = {"X-Redmine-API-Key": API_KEY}
        
        versions_response = requests.get(versions_url, headers=headers, timeout=10)
        
        if versions_response.status_code != 200:
            return {
                "success": False,
                "message": f"버전 정보 조회 실패 - 상태 코드: {versions_response.status_code}",
                "data": {}
            }
        
        versions_data = versions_response.json()
        versions = versions_data.get("versions", [])
        
        # 각 버전별로 연결된 일감들 조회
        results = []
        
        for version in versions[:3]:  # 처음 3개 버전만 테스트
            version_id = version.get("id")
            version_name = version.get("name")
            
            # 해당 버전에 연결된 일감들 조회
            issues_url = f"{REDMINE_URL}/issues.json?fixed_version_id={version_id}"
            issues_response = requests.get(issues_url, headers=headers, timeout=10)
            
            if issues_response.status_code == 200:
                issues_data = issues_response.json()
                issues = issues_data.get("issues", [])
                
                # 일감 정보 정리
                formatted_issues = []
                for issue in issues:
                    formatted_issues.append({
                        "id": issue.get("id"),
                        "subject": issue.get("subject"),
                        "status": issue.get("status", {}).get("name"),
                        "tracker": issue.get("tracker", {}).get("name"),
                        "assigned_to": issue.get("assigned_to", {}).get("name") if issue.get("assigned_to") else None,
                        "created_on": issue.get("created_on"),
                        "updated_on": issue.get("updated_on")
                    })
                
                results.append({
                    "version_id": version_id,
                    "version_name": version_name,
                    "connected_issues_count": len(issues),
                    "issues": formatted_issues
                })
            else:
                results.append({
                    "version_id": version_id,
                    "version_name": version_name,
                    "connected_issues_count": 0,
                    "error": f"일감 조회 실패 - 상태 코드: {issues_response.status_code}"
                })
        
        return {
            "success": True,
            "message": "로드맵 연결 일감 조회 테스트 완료",
            "data": {
                "project": "삼성전자 (ID: 100)",
                "total_versions": len(versions),
                "tested_versions": len(results),
                "results": results
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"로드맵 연결 일감 조회 중 오류 발생: {str(e)}",
            "data": {
                "error": str(e)
            }
        }

# 함수들을 하나씩 추가할 예정
