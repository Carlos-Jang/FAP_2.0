"""
FAP Redmine Database Manager
레드마인 일감 데이터를 로컬 MariaDB에 저장하고 관리하는 모듈
"""

import pymysql
from typing import List, Dict, Optional
import json
from datetime import datetime
import requests
from config import REDMINE_URL, API_KEY


class DatabaseManager:
    """레드마인 일감 데이터베이스 관리자"""
    
    def __init__(self):
        """데이터베이스 연결 설정 초기화"""
        self.db_config = {
            'host': 'localhost',
            'port': 3306,
            'user': 'root',
            'password': 'ati5344!',  # MariaDB root 비밀번호
            'database': 'fap_redmine',
            'charset': 'utf8mb4'
        }
    
    def get_connection(self):
        """데이터베이스 연결 반환"""
        try:
            conn = pymysql.connect(**self.db_config)
            return conn
        except Exception as e:
            print(f"DB 연결 실패: {e}")
            return None
    
    def _parse_issue_data(self, raw_data: str) -> Dict:
        """raw_data JSON 문자열을 파싱하여 딕셔너리로 변환"""
        if raw_data:
            try:
                return json.loads(raw_data)
            except json.JSONDecodeError:
                return {}
        return {}
    
    def _row_to_issue_dict(self, row) -> Dict:
        """데이터베이스 행을 일감 딕셔너리로 변환"""
        issue = {
            'id': row[0],
            'redmine_id': row[1],
            'raw_data': row[2],
            'created_at': row[3],
            'updated_at': row[4]
        }
        issue['data'] = self._parse_issue_data(issue['raw_data'])
        return issue
    
    def get_all_issues(self, limit: int = 100, offset: int = 0) -> List[Dict]:
        """모든 일감 정보 조회 (페이지네이션 지원)"""
        conn = self.get_connection()
        if not conn:
            return []
        
        try:
            cursor = conn.cursor()
            query = """
                SELECT id, redmine_id, raw_data, created_at, updated_at 
                FROM issues 
                ORDER BY updated_at DESC 
                LIMIT %s OFFSET %s
            """
            cursor.execute(query, (limit, offset))
            rows = cursor.fetchall()
            
            return [self._row_to_issue_dict(row) for row in rows]
            
        except Exception as e:
            print(f"일감 조회 실패: {e}")
            return []
        finally:
            conn.close()
    
    def get_issue_count(self) -> int:
        """전체 일감 개수 조회"""
        conn = self.get_connection()
        if not conn:
            return 0
        
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM issues")
            result = cursor.fetchone()
            return result[0] if result else 0
            
        except Exception as e:
            print(f"일감 개수 조회 실패: {e}")
            return 0
        finally:
            conn.close()
    
    def get_issue_by_id(self, issue_id: int) -> Optional[Dict]:
        """특정 일감 조회 (Redmine ID 기준)"""
        conn = self.get_connection()
        if not conn:
            return None
        
        try:
            cursor = conn.cursor()
            query = "SELECT * FROM issues WHERE redmine_id = %s"
            cursor.execute(query, (issue_id,))
            row = cursor.fetchone()
            
            return self._row_to_issue_dict(row) if row else None
            
        except Exception as e:
            print(f"일감 조회 실패: {e}")
            return None
        finally:
            conn.close()
    
    def search_issues(self, keyword: str, limit: int = 100) -> List[Dict]:
        """일감 검색 (제목, 설명에서 키워드 검색)"""
        conn = self.get_connection()
        if not conn:
            return []
        
        try:
            cursor = conn.cursor()
            # 대소문자 구분 없이 검색하고, JSON 내부의 subject와 description 필드도 검색
            query = """
                SELECT id, redmine_id, raw_data, created_at, updated_at 
                FROM issues 
                WHERE LOWER(raw_data) LIKE LOWER(%s) 
                   OR LOWER(raw_data) LIKE LOWER(%s)
                   OR LOWER(raw_data) LIKE LOWER(%s)
                ORDER BY updated_at DESC 
                LIMIT %s
            """
            search_pattern = f"%{keyword}%"
            subject_pattern = f"%\"subject\":\"%{keyword}%\"%"
            desc_pattern = f"%\"description\":\"%{keyword}%\"%"
            cursor.execute(query, (search_pattern, subject_pattern, desc_pattern, limit))
            rows = cursor.fetchall()
            
            return [self._row_to_issue_dict(row) for row in rows]
            
        except Exception as e:
            print(f"일감 검색 실패: {e}")
            return []
        finally:
            conn.close()

    def sync_recent_issues(self, limit: int = 100) -> Dict:
        """레드마인에서 최근 일감을 가져와서 DB에 저장 (50개씩 병렬 처리, 기존 DB 삭제 후 새로 추가)"""
        try:
            from concurrent.futures import ThreadPoolExecutor, as_completed
            
            print(f"레드마인 API 병렬 호출 중... (50개씩 배치 처리)")
            
            # 1. 먼저 API 연결 확인
            test_url = f"{REDMINE_URL}/issues.json"
            test_params = {'limit': 1, 'key': API_KEY}
            test_response = requests.get(test_url, params=test_params, timeout=10)
            
            if test_response.status_code != 200:
                return {
                    'success': False,
                    'error': f'레드마인 API 연결 실패: {test_response.status_code}',
                    'count': 0
                }
            
            # 2. 50개씩 나누어서 병렬로 API 호출
            all_issues = []
            batch_size = 50
            offset = 0
            
            def fetch_issues_batch(batch_offset):
                """50개씩 일감을 가져오는 함수"""
                url = f"{REDMINE_URL}/issues.json"
                params = {
                    'limit': batch_size,
                    'offset': batch_offset,
                    'sort': 'updated_on:desc',  # 최근 수정된 순으로 정렬
                    'key': API_KEY
                }
                
                try:
                    response = requests.get(url, params=params, timeout=30)
                    if response.status_code == 200:
                        data = response.json()
                        issues = data.get('issues', [])
                        print(f"배치 {batch_offset//batch_size + 1}: {len(issues)}개 일감 가져옴")
                        return issues
                    else:
                        print(f"배치 {batch_offset//batch_size + 1}: API 호출 실패 (status: {response.status_code})")
                        return []
                except Exception as e:
                    print(f"배치 {batch_offset//batch_size + 1}: 에러 - {str(e)}")
                    return []
            
            # 병렬로 여러 배치를 동시에 처리
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = []
                
                # 입력받은 limit만큼 배치 계산
                max_batches = (limit + batch_size - 1) // batch_size  # 올림 나눗셈
                print(f"총 {max_batches}개 배치를 처리합니다 (최대 {limit}개 일감)")
                
                for i in range(max_batches):
                    batch_offset = i * batch_size
                    future = executor.submit(fetch_issues_batch, batch_offset)
                    futures.append(future)
                
                # 모든 배치 결과 수집
                for future in as_completed(futures):
                    batch_issues = future.result()
                    if batch_issues:
                        all_issues.extend(batch_issues)
                    # 빈 배치가 나와도 계속 진행 (더 많은 데이터가 있을 수 있음)
            
            if not all_issues:
                return {
                    'success': True,
                    'message': '동기화할 일감이 없습니다.',
                    'count': 0
                }
            
            print(f"총 {len(all_issues)}개 일감을 가져왔습니다.")
            
            # 3. DB에 저장
            conn = self.get_connection()
            if not conn:
                return {
                    'success': False,
                    'error': 'DB 연결 실패',
                    'count': 0
                }
            
            cursor = conn.cursor()
            
            # 기존 issues 테이블 전체 삭제
            print("기존 일감 데이터 삭제 중...")
            cursor.execute("DELETE FROM issues")
            deleted_count = cursor.rowcount
            print(f"기존 {deleted_count}개 일감 데이터 삭제 완료")
            
            # 새로운 일감 데이터 삽입
            print("새로운 일감 데이터 삽입 중...")
            saved_count = 0
            
            for issue in all_issues:
                redmine_id = issue.get('id')
                if not redmine_id:
                    continue
                
                # 새 일감 추가
                cursor.execute("""
                    INSERT INTO issues (redmine_id, raw_data, created_at, updated_at) 
                    VALUES (%s, %s, NOW(), NOW())
                """, (redmine_id, json.dumps(issue, ensure_ascii=False)))
                saved_count += 1
            
            conn.commit()
            conn.close()
            
            return {
                'success': True,
                'message': f'일감 동기화 완료: 기존 {deleted_count}개 삭제, 새로 {saved_count}개 추가',
                'count': len(all_issues),
                'saved': saved_count,
                'deleted': deleted_count
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'일감 동기화 실패: {str(e)}',
                'count': 0
            }

    # ===== 프로젝트 관련 메서드들 =====
    
    def _row_to_project_dict(self, row) -> Dict:
        """데이터베이스 행을 프로젝트 딕셔너리로 변환"""
        project = {
            'id': row[0],
            'redmine_project_id': row[1],
            'project_name': row[2],
            'raw_data': row[3],
            'created_at': row[4],
            'updated_at': row[5]
        }
        project['data'] = self._parse_issue_data(project['raw_data'])  # 일감과 동일한 방식
        return project
    
    def get_all_projects(self, limit: int = 100, offset: int = 0) -> List[Dict]:
        """모든 프로젝트 정보 조회 (페이지네이션 지원)"""
        conn = self.get_connection()
        if not conn:
            return []
        
        try:
            cursor = conn.cursor()
            query = """
                SELECT id, redmine_project_id, project_name, raw_data, created_at, updated_at 
                FROM projects 
                ORDER BY project_name ASC 
                LIMIT %s OFFSET %s
            """
            cursor.execute(query, (limit, offset))
            rows = cursor.fetchall()
            
            return [self._row_to_project_dict(row) for row in rows]
            
        except Exception as e:
            print(f"프로젝트 조회 실패: {e}")
            return []
        finally:
            conn.close()
    
    def get_project_count(self) -> int:
        """전체 프로젝트 개수 조회"""
        conn = self.get_connection()
        if not conn:
            return 0
        
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM projects")
            result = cursor.fetchone()
            return result[0] if result else 0
            
        except Exception as e:
            print(f"프로젝트 개수 조회 실패: {e}")
            return 0
        finally:
            conn.close()
    
    def get_project_by_id(self, project_id: int) -> Optional[Dict]:
        """특정 프로젝트 조회 (Redmine 프로젝트 ID 기준)"""
        conn = self.get_connection()
        if not conn:
            return None
        
        try:
            cursor = conn.cursor()
            query = "SELECT id, redmine_project_id, project_name, raw_data, created_at, updated_at FROM projects WHERE redmine_project_id = %s"
            cursor.execute(query, (project_id,))
            row = cursor.fetchone()
            
            return self._row_to_project_dict(row) if row else None
            
        except Exception as e:
            print(f"프로젝트 조회 실패: {e}")
            return None
        finally:
            conn.close()

    def sync_projects(self, limit: int = 1000) -> Dict:
        """레드마인에서 프로젝트 목록을 가져와서 DB에 저장 (50개씩 병렬 처리)"""
        try:
            from concurrent.futures import ThreadPoolExecutor, as_completed
            
            print(f"레드마인 API 병렬 호출 중... (50개씩 배치 처리)")
            
            # 1. 먼저 전체 프로젝트 개수 확인
            test_url = f"{REDMINE_URL}/projects.json"
            test_params = {'limit': 1, 'key': API_KEY}
            test_response = requests.get(test_url, params=test_params, timeout=10)
            
            if test_response.status_code != 200:
                return {
                    'success': False,
                    'error': f'레드마인 API 연결 실패: {test_response.status_code}',
                    'count': 0
                }
            
            # 2. 50개씩 나누어서 병렬로 API 호출
            all_projects = []
            batch_size = 50
            offset = 0
            
            def fetch_projects_batch(batch_offset):
                """50개씩 프로젝트를 가져오는 함수"""
                url = f"{REDMINE_URL}/projects.json"
                params = {
                    'limit': batch_size,
                    'offset': batch_offset,
                    'key': API_KEY
                }
                
                try:
                    response = requests.get(url, params=params, timeout=30)
                    if response.status_code == 200:
                        data = response.json()
                        projects = data.get('projects', [])
                        print(f"배치 {batch_offset//batch_size + 1}: {len(projects)}개 프로젝트 가져옴")
                        return projects
                    else:
                        print(f"배치 {batch_offset//batch_size + 1}: API 호출 실패 (status: {response.status_code})")
                        return []
                except Exception as e:
                    print(f"배치 {batch_offset//batch_size + 1}: 에러 - {str(e)}")
                    return []
            
            # 병렬로 여러 배치를 동시에 처리
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = []
                
                # 입력받은 limit만큼 배치 계산
                max_batches = (limit + batch_size - 1) // batch_size  # 올림 나눗셈
                print(f"총 {max_batches}개 배치를 처리합니다 (최대 {limit}개 프로젝트)")
                
                for i in range(max_batches):
                    batch_offset = i * batch_size
                    future = executor.submit(fetch_projects_batch, batch_offset)
                    futures.append(future)
                
                # 모든 배치 결과 수집
                for future in as_completed(futures):
                    batch_projects = future.result()
                    if batch_projects:
                        all_projects.extend(batch_projects)
                    # 빈 배치가 나와도 계속 진행 (더 많은 데이터가 있을 수 있음)
            
            if not all_projects:
                return {
                    'success': True,
                    'message': '동기화할 프로젝트가 없습니다.',
                    'count': 0
                }
            
            print(f"총 {len(all_projects)}개 프로젝트를 가져왔습니다.")
            
            # 3. DB에 저장
            conn = self.get_connection()
            if not conn:
                return {
                    'success': False,
                    'error': 'DB 연결 실패',
                    'count': 0
                }
            
            cursor = conn.cursor()
            
            # 기존 projects 테이블 전체 삭제
            print("기존 프로젝트 데이터 삭제 중...")
            cursor.execute("TRUNCATE TABLE projects")
            
            # 새로운 프로젝트 데이터 삽입
            print("새로운 프로젝트 데이터 삽입 중...")
            saved_count = 0
            
            for project in all_projects:
                redmine_project_id = project.get('id')
                project_name = project.get('name', '')
                
                if not redmine_project_id or not project_name:
                    continue
                
                # 새 프로젝트 추가 (전체 JSON 저장)
                cursor.execute("""
                    INSERT INTO projects (redmine_project_id, project_name, raw_data, created_at, updated_at) 
                    VALUES (%s, %s, %s, NOW(), NOW())
                """, (redmine_project_id, project_name, json.dumps(project, ensure_ascii=False)))
                saved_count += 1
            
            conn.commit()
            conn.close()
            
            return {
                'success': True,
                'message': f'프로젝트 동기화 완료: {saved_count}개 프로젝트 저장',
                'count': len(all_projects),
                'saved': saved_count,
                'updated': 0
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'프로젝트 동기화 실패: {str(e)}',
                'count': 0
            }