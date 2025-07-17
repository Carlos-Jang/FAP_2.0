"""
FAP Redmine Database Manager
레드마인 일감 데이터를 로컬 MariaDB에 저장하고 관리하는 모듈
"""

import pymysql
from typing import List, Dict, Optional
import json
from datetime import datetime
import requests
from config import REDMINE_URL, API_KEY, CUSTOMER_PROJECT_IDS, ATI_PROJECT_IDS


class DatabaseManager:
    """레드마인 일감 데이터베이스 관리자"""
    
    def __init__(self):  # 수정 불가
        """데이터베이스 연결 설정 초기화"""
        self.db_config = {
            'host': 'localhost',
            'port': 3306,
            'user': 'root',
            'password': 'ati5344!',  # MariaDB root 비밀번호
            'database': 'fap_redmine',
            'charset': 'utf8mb4'
        }
    
    def get_connection(self):  # 수정 불가
        """데이터베이스 연결 반환"""
        try:
            conn = pymysql.connect(**self.db_config)
            return conn
        except Exception as e:
            print(f"DB 연결 실패: {e}")
            return None
    
    def update_projects_table_structure(self) -> bool:  # 수정 불가
        """프로젝트 테이블 구조를 7개 컬럼으로 업데이트"""
        conn = self.get_connection()
        if not conn:
            return False
        
        try:
            cursor = conn.cursor()
            
            # children_ids 컬럼이 있는지 확인
            cursor.execute("SHOW COLUMNS FROM projects LIKE 'children_ids'")
            if not cursor.fetchone():
                print("children_ids 컬럼 추가 중...")
                cursor.execute("ALTER TABLE projects ADD COLUMN children_ids JSON AFTER raw_data")
            
            # level 컬럼이 있는지 확인
            cursor.execute("SHOW COLUMNS FROM projects LIKE 'level'")
            if not cursor.fetchone():
                print("level 컬럼 추가 중...")
                cursor.execute("ALTER TABLE projects ADD COLUMN level INT DEFAULT 0 AFTER children_ids")
            
            # 기존 데이터의 level을 0으로 설정
            cursor.execute("UPDATE projects SET level = 0 WHERE level IS NULL")
            
            conn.commit()
            print("프로젝트 테이블 구조 업데이트 완료")
            return True
            
        except Exception as e:
            print(f"테이블 구조 업데이트 실패: {e}")
            return False
        finally:
            conn.close()

# ===== 일감 관련 메서드들 =====        
    
    def _parse_issue_data(self, raw_data: str) -> Dict:  # 수정 불가
        """raw_data JSON 문자열을 파싱하여 딕셔너리로 변환"""
        if raw_data:
            try:
                return json.loads(raw_data)
            except json.JSONDecodeError:
                return {}
        return {}
    
    def _row_to_issue_dict(self, row) -> Dict:  # 수정 불가
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
    
    def sync_recent_issues(self, limit: int = 100) -> Dict:  # 수정 불가
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
    
    def _row_to_project_dict(self, row) -> Dict:  # 수정 불가
        """데이터베이스 행을 프로젝트 딕셔너리로 변환"""
        project = {
            'id': row[0],
            'redmine_project_id': row[1],
            'project_name': row[2],
            'raw_data': row[3],
            'children_ids': row[4],  # 새로 추가된 컬럼
            'level': row[5],         # 새로 추가된 컬럼
            'created_at': row[6],
            'updated_at': row[7]
        }
        project['data'] = self._parse_issue_data(project['raw_data'])  # 일감과 동일한 방식
        return project
      
    def sync_projects(self, limit: int = 1000) -> Dict:  # 수정 불가
        """레드마인에서 프로젝트 목록을 가져와서 DB에 저장 (50개씩 병렬 처리)"""
        try:
            from concurrent.futures import ThreadPoolExecutor, as_completed
            
            # 테이블 구조 업데이트 확인
            self.update_projects_table_structure()
            
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
                

                
                # 하위 프로젝트 ID들 가져오기
                children_ids = []
                level = 1  # 기본값: 최상위 프로젝트
                
                # Redmine API로 하위 프로젝트 조회
                try:
                    children_url = f"{REDMINE_URL}/projects.json?parent_id={redmine_project_id}"
                    children_response = requests.get(children_url, params={'key': API_KEY}, timeout=10)
                    if children_response.status_code == 200:
                        children_data = children_response.json()
                        children_ids = [child.get('id') for child in children_data.get('projects', [])]
                        
                        # 부모 프로젝트 정보 확인
                        parent_id = project.get('parent', {}).get('id')
                        
                        # 특정 프로젝트 하드코딩 레벨 설정
                        if redmine_project_id == ATI_PROJECT_IDS['ATI_HEADQUARTERS']:  # 00. ATI 본사
                            level = 11
                        elif redmine_project_id == ATI_PROJECT_IDS['ATI_SAMPLE_EVALUATION']:  # ATI 시료 평가
                            level = 21
                        elif redmine_project_id == ATI_PROJECT_IDS['ATI_GUIDE']:  # PMS System 안내
                            level = 31
                        else:
                            # 레벨 설정 로직
                            if parent_id is None:
                                level = 1  # 최상위 (고객사)
                            elif parent_id == ATI_PROJECT_IDS['ATI_HEADQUARTERS']:  # 부모가 00. ATI 본사인 경우
                                level = 12
                            elif not children_ids:
                                level = 4  # 최하위 (설비/라인)
                            elif parent_id in CUSTOMER_PROJECT_IDS:
                                level = 2  # 고객사의 직접 하위 (지역)
                            else:
                                level = 3  # 지역의 하위 (건물명)
                                
                except Exception as e:
                    print(f"프로젝트 {redmine_project_id} 하위 프로젝트 조회 실패: {e}")
                
                # 새 프로젝트 추가 (7개 컬럼 모두 저장)
                cursor.execute("""
                    INSERT INTO projects (redmine_project_id, project_name, raw_data, children_ids, level, created_at, updated_at) 
                    VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                """, (
                    redmine_project_id, 
                    project_name, 
                    json.dumps(project, ensure_ascii=False),
                    json.dumps(children_ids, ensure_ascii=False),
                    level
                ))
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

    def get_projects_by_ids(self, project_ids: List[int]) -> List[Dict]:  # 수정 불가
        """프로젝트 ID 리스트로 해당 프로젝트들의 전체 정보 조회"""
        if not project_ids:
            return []
        
        conn = self.get_connection()
        if not conn:
            return []
        
        try:
            cursor = conn.cursor()
            
            # ID 리스트를 문자열로 변환하여 IN 절에 사용
            id_placeholders = ','.join(['%s'] * len(project_ids))
            query = f"""
                SELECT id, redmine_project_id, project_name, raw_data, children_ids, level, created_at, updated_at 
                FROM projects 
                WHERE redmine_project_id IN ({id_placeholders})
                ORDER BY project_name ASC
            """
            
            cursor.execute(query, project_ids)
            rows = cursor.fetchall()
            
            return [self._row_to_project_dict(row) for row in rows]
            
        except Exception as e:
            print(f"프로젝트 ID별 조회 실패: {e}")
            return []
        finally:
            conn.close()