"""
FAP 2.0 - 데이터베이스 관리 클래스 (백엔드)

주요 기능:
- 데이터베이스 연결 관리: MariaDB 연결 설정 및 연결 풀 관리
- 로드맵 데이터 관리: 로드맵 정보 저장/조회/분석
- 이슈 데이터 관리: 이슈 정보 저장/조회/분석
- 사용자 API 키 관리: 암호화/복호화, 개인별 키 저장 및 검증
- PMS 데이터 동기화: 관리자 수동 실행으로 대량 데이터 동기화

데이터 구조:
- 로드맵 테이블: 로드맵 정보 및 연결된 이슈 ID
- 이슈 테이블: 이슈 상세 정보 및 상태
- 사용자 API 키 테이블: login, encrypted_api_key, created_at

기술 스택:
- MariaDB (PyMySQL)
- JSON 데이터 처리
- 암호화 (Fernet)
- Redmine API 연동

데이터 흐름:
1. Redmine API에서 데이터 조회
2. 로컬 MariaDB에 저장
3. 프론트엔드에서 조회 요청
4. 가공된 데이터 반환
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
            'user': 'fap',
            'password': 'ati5344',  # MariaDB root 비밀번호
            'database': 'fap_redmine',
            'charset': 'utf8mb4'
        }
    
    def get_connection(self):  # 수정 불가
        """데이터베이스 연결 반환"""
        try:
            conn = pymysql.connect(**self.db_config)
            return conn
        except Exception as e:
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
                cursor.execute("ALTER TABLE projects ADD COLUMN children_ids JSON AFTER raw_data")
            
            # level 컬럼이 있는지 확인
            cursor.execute("SHOW COLUMNS FROM projects LIKE 'level'")
            if not cursor.fetchone():
                cursor.execute("ALTER TABLE projects ADD COLUMN level INT DEFAULT 0 AFTER children_ids")
            
            # 기존 데이터의 level을 0으로 설정
            cursor.execute("UPDATE projects SET level = 0 WHERE level IS NULL")
            
            conn.commit()
            return True
            
        except Exception as e:
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
    
    def get_issues_by_filter(self, start_date: str, end_date: str, project_ids: List[int]) -> List[Dict]: # 수정 불가
        """기간과 프로젝트 ID로 필터링해서 모든 데이터를 가져오는 메서드"""
        conn = self.get_connection()
        if not conn:
            return []
        
        try:
            cursor = conn.cursor()
            
            # project_ids 리스트를 문자열로 변환하여 IN 절에 사용
            id_placeholders = ','.join(['%s'] * len(project_ids))
            
            # 기간과 프로젝트 ID로 필터링하여 모든 컬럼 조회
            query = f"""
                SELECT redmine_id, project_id, project_name, tracker_id, tracker_name,
                       status_id, status_name, is_closed, priority_id, priority_name,
                       author_id, author_name, assigned_to_id, assigned_to_name,
                       subject, description, cost, pending, product,
                       created_on, updated_on, raw_data
                FROM issues 
                WHERE created_on >= %s AND created_on <= %s
                   AND project_id IN ({id_placeholders})
                ORDER BY updated_on DESC
            """
            
            # 파라미터 준비 (기간 2개 + 프로젝트 ID들)
            params = [start_date, end_date] + project_ids
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            # 결과를 딕셔너리 리스트로 변환
            issues = []
            for row in rows:
                issue = {
                    'redmine_id': row[0],
                    'project_id': row[1],
                    'project_name': row[2],
                    'tracker_id': row[3],
                    'tracker_name': row[4],
                    'status_id': row[5],
                    'status_name': row[6],
                    'is_closed': row[7],
                    'priority_id': row[8],
                    'priority_name': row[9],
                    'author_id': row[10],
                    'author_name': row[11],
                    'assigned_to_id': row[12],
                    'assigned_to_name': row[13],
                    'subject': row[14],
                    'description': row[15],
                    'cost': row[16],
                    'pending': row[17],
                    'product': row[18],
                    'created_on': row[19],
                    'updated_on': row[20],
                    'raw_data': row[21]
                }
                issues.append(issue)
            
            return issues
            
        except Exception as e:
            print(f"필터링된 일감 조회 실패: {e}")
            return []
        finally:
            conn.close()
    
    def get_issue_by_id(self, issue_id: int) -> Dict: # 수정 불가
        """특정 ID의 일감 정보를 조회하는 메서드"""
        conn = self.get_connection()
        if not conn:
            return {}
        
        try:
            cursor = conn.cursor(pymysql.cursors.DictCursor)
            
            # 해당 ID의 일감 정보 조회
            query = """
                SELECT redmine_id, project_id, project_name, tracker_id, tracker_name,
                       status_id, status_name, is_closed, priority_id, priority_name,
                       author_id, author_name, assigned_to_id, assigned_to_name,
                       subject, description, cost, pending, product,
                       created_on, updated_on, raw_data
                FROM issues 
                WHERE redmine_id = %s
            """
            
            cursor.execute(query, (issue_id,))
            row = cursor.fetchone()
            
            if row:
                issue = {
                    'redmine_id': row.get('redmine_id'),
                    'project_id': row.get('project_id'),
                    'project_name': row.get('project_name'),
                    'tracker_id': row.get('tracker_id'),
                    'tracker_name': row.get('tracker_name'),
                    'status_id': row.get('status_id'),
                    'status_name': row.get('status_name'),
                    'is_closed': row.get('is_closed'),
                    'priority_id': row.get('priority_id'),
                    'priority_name': row.get('priority_name'),
                    'author_id': row.get('author_id'),
                    'author_name': row.get('author_name'),
                    'assigned_to_id': row.get('assigned_to_id'),
                    'assigned_to_name': row.get('assigned_to_name'),
                    'subject': row.get('subject'),
                    'description': row.get('description'),
                    'cost': row.get('cost'),
                    'pending': row.get('pending'),
                    'product': row.get('product'),
                    'created_on': row.get('created_on'),
                    'updated_on': row.get('updated_on'),
                    'raw_data': row.get('raw_data')
                }
                return issue
            else:
                return {}
            
        except Exception as e:
            print(f"일감 ID {issue_id} 조회 실패: {e}")
            return {}
        finally:
            conn.close()
    
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

    def sync_recent_issues_full_data(self, limit: int = 100) -> Dict: # 수정 불가
        """레드마인에서 최근 일감을 가져와서 DB에 저장 (전체 컬럼 분해 저장, 병렬 처리)"""
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
                    'key': API_KEY,
                    'status_id': '*'  # 모든 상태의 일감 가져오기 (완료, 진행중 모두)
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
            
            # 새로운 일감 데이터 삽입 (컬럼 분해)
            print("새로운 일감 데이터 삽입 중...")
            saved_count = 0
            
            for issue in all_issues:
                # 기본 정보 추출
                redmine_id = issue.get('id')
                if not redmine_id:
                    continue
                
                # Project 정보
                project = issue.get('project', {})
                project_id = project.get('id')
                project_name = project.get('name', '')
                
                # Tracker 정보
                tracker = issue.get('tracker', {})
                tracker_id = tracker.get('id')
                tracker_name = tracker.get('name', '')
                
                # Status 정보
                status = issue.get('status', {})
                status_id = status.get('id')
                status_name = status.get('name', '')
                is_closed = status.get('is_closed', False)
                
                # Priority 정보
                priority = issue.get('priority', {})
                priority_id = priority.get('id')
                priority_name = priority.get('name', '')
                
                # Author 정보
                author = issue.get('author', {})
                author_id = author.get('id')
                author_name = author.get('name', '')
                
                # Assigned to 정보
                assigned_to = issue.get('assigned_to', {})
                assigned_to_id = assigned_to.get('id') if assigned_to else None
                assigned_to_name = assigned_to.get('name', '') if assigned_to else ''
                
                # 기본 필드
                subject = issue.get('subject', '')
                description = issue.get('description', '')
                
                # 커스텀 필드 추출
                custom_fields = issue.get('custom_fields', [])
                cost = ''
                pending = ''
                product = ''
                
                for field in custom_fields:
                    field_name = field.get('name', '')
                    field_value = field.get('value', '')
                    
                    if '비용' in field_name:
                        cost = field_value
                    elif 'pending' in field_name.lower():
                        pending = field_value
                    elif '설비군' in field_name or 'product' in field_name.lower():
                        product = field_value
                
                # 시간 정보 (UTC → 한국시간 변환)
                created_on_utc = issue.get('created_on', '')
                updated_on_utc = issue.get('updated_on', '')
                
                # UTC를 한국시간으로 변환
                created_on = ''
                updated_on = ''
                
                if created_on_utc:
                    try:
                        from datetime import datetime, timedelta
                        utc_dt = datetime.fromisoformat(created_on_utc.replace('Z', '+00:00'))
                        korea_dt = utc_dt + timedelta(hours=9)
                        created_on = korea_dt.isoformat()
                    except Exception as e:
                        print(f"created_on 시간 변환 실패: {created_on_utc}, 에러: {str(e)}")
                        created_on = created_on_utc  # 변환 실패시 원본 사용
                
                if updated_on_utc:
                    try:
                        from datetime import datetime, timedelta
                        utc_dt = datetime.fromisoformat(updated_on_utc.replace('Z', '+00:00'))
                        korea_dt = utc_dt + timedelta(hours=9)
                        updated_on = korea_dt.isoformat()
                    except Exception as e:
                        print(f"updated_on 시간 변환 실패: {updated_on_utc}, 에러: {str(e)}")
                        updated_on = updated_on_utc  # 변환 실패시 원본 사용
                
                # 새 일감 추가 (모든 컬럼 포함)
                cursor.execute("""
                    INSERT INTO issues (
                        redmine_id, raw_data, created_at, updated_at,
                        project_id, project_name, tracker_id, tracker_name,
                        status_id, status_name, is_closed, priority_id, priority_name,
                        author_id, author_name, assigned_to_id, assigned_to_name,
                        subject, description, cost, pending, product,
                        created_on, updated_on
                    ) VALUES (
                        %s, %s, NOW(), NOW(),
                        %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s
                    )
                """, (
                    redmine_id, json.dumps(issue, ensure_ascii=False),
                    project_id, project_name, tracker_id, tracker_name,
                    status_id, status_name, is_closed, priority_id, priority_name,
                    author_id, author_name, assigned_to_id, assigned_to_name,
                    subject, description, cost, pending, product,
                    created_on, updated_on
                ))
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

    def sync_issue_status(self) -> Dict: # 수정 불가
        """이슈 상태 목록 동기화"""
        conn = None
        cursor = None
        try:
            # Redmine API 호출
            url = f"{REDMINE_URL}/issue_statuses.json"
            headers = {'X-Redmine-API-Key': API_KEY}
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                issue_statuses = data.get('issue_statuses', [])
                
                # DB 연결
                conn = self.get_connection()
                if not conn:
                    return {
                        "success": False,
                        "message": "DB 연결 실패"
                    }
                
                cursor = conn.cursor()
                
                # 기존 issue_statuses 테이블 전체 삭제
                cursor.execute("DELETE FROM issue_statuses")
                
                # 새로운 이슈 상태 데이터 삽입
                saved_count = 0
                
                for status in issue_statuses:
                    status_id = status.get('id')
                    status_name = status.get('name')
                    is_closed = status.get('is_closed', False)
                    
                    if status_id and status_name:
                        cursor.execute("""
                            INSERT INTO issue_statuses (id, status_name, is_closed)
                            VALUES (%s, %s, %s)
                        """, (status_id, status_name, is_closed))
                        saved_count += 1
                
                conn.commit()
                
                return {
                    "success": True,
                    "message": f"이슈 상태 동기화 완료! 총 {saved_count}개 상태 저장됨",
                    "data": {
                        "count": saved_count
                    }
                }
            else:
                return {
                    "success": False,
                    "message": f"Redmine API 호출 실패: {response.status_code}"
                }
                
        except Exception as e:
            if conn:
                conn.rollback()
            return {
                "success": False,
                "message": f"이슈 상태 동기화 실패: {str(e)}"
            }
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    def get_status_id_by_name(self, status_name: str) -> Dict: # 수정 불가
        """상태명으로 상태 ID 조회"""
        try:
            conn = self.get_connection()
            if not conn:
                return {
                    "success": False,
                    "message": "DB 연결 실패"
                }
            
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id FROM issue_statuses 
                WHERE status_name = %s
            """, (status_name,))
            
            result = cursor.fetchone()
            
            if result:
                return {
                    "success": True,
                    "message": "상태 ID 조회 성공",
                    "data": {
                        "status_id": result[0],
                        "status_name": status_name
                    }
                }
            else:
                return {
                    "success": False,
                    "message": f"상태명 '{status_name}'에 해당하는 ID를 찾을 수 없습니다."
                }
                
        except Exception as e:
            return {
                "success": False,
                "message": f"상태 ID 조회 중 오류 발생: {str(e)}"
            }
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    def set_update_issue_statusname(self, redmine_id: int, old_status_name: str, new_status_name: str) -> Dict: # 수정 불가
        """이슈 상태명 업데이트 함수"""
        try:
            conn = self.get_connection()
            if not conn:
                return {
                    "success": False,
                    "message": "DB 연결 실패"
                }
            
            cursor = conn.cursor()
            
            # 1. 먼저 해당 이슈가 존재하고 현재 상태가 old_status_name과 일치하는지 확인
            cursor.execute("""
                SELECT status_name FROM issues 
                WHERE redmine_id = %s
            """, (redmine_id,))
            
            result = cursor.fetchone()
            if not result:
                return {
                    "success": False,
                    "message": f"이슈 #{redmine_id}를 찾을 수 없습니다."
                }
            
            current_status_name = result[0]
            if current_status_name != old_status_name:
                return {
                    "success": False,
                    "message": f"이슈 #{redmine_id}의 현재 상태가 일치하지 않습니다. 현재: {current_status_name}, 예상: {old_status_name}"
                }
            
            # 3. DB 업데이트 (status_name만 업데이트)
            cursor.execute("""
                UPDATE issues 
                SET status_name = %s, updated_at = NOW()
                WHERE redmine_id = %s
            """, (new_status_name, redmine_id))
            
            conn.commit()
            
            # 4. 업데이트 결과 확인
            if cursor.rowcount == 0:
                return {
                    "success": False,
                    "message": f"이슈 #{redmine_id} 상태 업데이트에 실패했습니다."
                }
            
            return {
                "success": True,
                "message": f"이슈 #{redmine_id} 상태가 성공적으로 변경되었습니다: {old_status_name} → {new_status_name}",
                "data": {
                    "redmine_id": redmine_id,
                    "old_status": old_status_name,
                    "new_status": new_status_name
                }
            }
            
        except Exception as e:
            if conn:
                conn.rollback()
            return {
                "success": False,
                "message": f"DB 업데이트 중 오류 발생: {str(e)}"
            }
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

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

    def get_projects_by_name(self, project_name: str) -> List[Dict]: # 수정 불가
        """프로젝트 이름으로 프로젝트 정보 조회"""
        if not project_name:
            return []
        
        conn = self.get_connection()
        if not conn:
            return []
        
        try:
            cursor = conn.cursor()
            
            query = """
                SELECT id, redmine_project_id, project_name, raw_data, children_ids, level, created_at, updated_at 
                FROM projects 
                WHERE project_name = %s
                ORDER BY project_name ASC
            """
            
            cursor.execute(query, (project_name,))
            rows = cursor.fetchall()
            
            return [self._row_to_project_dict(row) for row in rows]
            
        except Exception as e:
            print(f"프로젝트 이름별 조회 실패: {e}")
            return []
        finally:
            conn.close()

    def sync_projects_fast(self, limit: int = 1000) -> Dict: # 수정 불가
        """레드마인에서 프로젝트 목록을 빠르게 가져와서 DB에 저장 (자식 프로젝트 조회 없이)"""
        try:
            from concurrent.futures import ThreadPoolExecutor, as_completed
            
            print(f"레드마인 API 빠른 병렬 호출 중... (50개씩 배치 처리)")
            
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
            
            # 3. DB에 저장 (projects_default 테이블)
            conn = self.get_connection()
            if not conn:
                return {
                    'success': False,
                    'error': 'DB 연결 실패',
                    'count': 0
                }
            
            cursor = conn.cursor()
            
            # projects_default 테이블이 없으면 생성
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS projects_default (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    redmine_id INT,
                    project_name VARCHAR(255),
                    raw_data JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            """)
            
            # 기존 projects_default 테이블 전체 삭제
            print("기존 프로젝트 데이터 삭제 중...")
            cursor.execute("TRUNCATE TABLE projects_default")
            
            # 새로운 프로젝트 데이터 삽입
            print("새로운 프로젝트 데이터 삽입 중...")
            saved_count = 0
            
            for project in all_projects:
                redmine_project_id = project.get('id')
                project_name = project.get('name', '')
                
                if not redmine_project_id or not project_name:
                    continue
                
                # 단순 저장 (관계 설정 없이)
                cursor.execute("""
                    INSERT INTO projects_default (redmine_id, project_name, raw_data) 
                    VALUES (%s, %s, %s)
                """, (
                    redmine_project_id, 
                    project_name, 
                    json.dumps(project, ensure_ascii=False)
                ))
                saved_count += 1
            
            conn.commit()
            conn.close()
            
            # 관계 분석 및 projects 테이블에 저장
            self.analyze_and_save_project_relationships()
            
            return {
                'success': True,
                'message': f'프로젝트 동기화 완료: {saved_count}개 프로젝트 저장 (관계 분석 포함)',
                'count': len(all_projects),
                'saved': saved_count,
                'updated': 0
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'프로젝트 빠른 동기화 실패: {str(e)}',
                'count': 0
            }

    def analyze_and_save_project_relationships(self) -> Dict: # 수정 불가
        """projects_default에서 관계 분석해서 projects 테이블에 저장"""
        try:
            print("프로젝트 관계 분석 및 저장 시작...")
            
            # 1. DB 연결
            conn = self.get_connection()
            if not conn:
                return {
                    'success': False,
                    'error': 'DB 연결 실패'
                }
            
            cursor = conn.cursor()
            
            # 2. 기존 projects 테이블 전체 삭제
            print("기존 projects 테이블 데이터 삭제 중...")
            cursor.execute("TRUNCATE TABLE projects")
            
            # 3. projects_default에서 모든 프로젝트 데이터 가져오기
            print("projects_default에서 프로젝트 데이터 가져오는 중...")
            cursor.execute("SELECT redmine_id, project_name, raw_data FROM projects_default")
            projects_data = cursor.fetchall()
            
            if not projects_data:
                return {
                    'success': False,
                    'error': 'projects_default에 데이터가 없습니다.'
                }
            
            print(f"총 {len(projects_data)}개 프로젝트 데이터를 가져왔습니다.")
            
            # 4. 프로젝트 데이터를 딕셔너리로 변환
            projects_dict = {}
            for row in projects_data:
                redmine_id = row[0]
                project_name = row[1]
                raw_data = row[2]
                
                try:
                    project_info = json.loads(raw_data)
                    projects_dict[redmine_id] = {
                        'id': redmine_id,
                        'name': project_name,
                        'raw_data': raw_data,
                        'parent': project_info.get('parent', {}),
                        'children_ids': []
                    }
                except json.JSONDecodeError:
                    continue
            
            # 5. 부모-자식 관계 분석
            print("부모-자식 관계 분석 중...")
            for project_id, project_info in projects_dict.items():
                parent = project_info.get('parent', {})
                parent_id = parent.get('id')
                
                if parent_id and parent_id in projects_dict:
                    # 부모가 있으면 자식 리스트에 추가
                    projects_dict[parent_id]['children_ids'].append(project_id)
            
            # 6. 레벨 계산
            print("프로젝트 레벨 계산 중...")
            for project_id, project_info in projects_dict.items():
                level = self.calculate_project_level(project_id, projects_dict)
                project_info['level'] = level
            
            # 7. projects 테이블에 저장
            print("projects 테이블에 데이터 저장 중...")
            saved_count = 0
            
            for project_id, project_info in projects_dict.items():
                cursor.execute("""
                    INSERT INTO projects (redmine_project_id, project_name, raw_data, children_ids, level, created_at, updated_at) 
                    VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                """, (
                    project_info['id'],
                    project_info['name'],
                    project_info['raw_data'],
                    json.dumps(project_info['children_ids'], ensure_ascii=False),
                    project_info['level']
                ))
                saved_count += 1
            
            conn.commit()
            conn.close()
            
            print(f"프로젝트 관계 분석 완료: {saved_count}개 프로젝트 저장")
            
            return {
                'success': True,
                'message': f'프로젝트 관계 분석 완료: {saved_count}개 프로젝트 저장',
                'count': saved_count
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'프로젝트 관계 분석 실패: {str(e)}'
            }
    
    def calculate_project_level(self, project_id: int, projects_dict: Dict) -> int: # 수정 불가
        """프로젝트 레벨 계산"""
        from config import ATI_PROJECT_IDS, CUSTOMER_PROJECT_IDS
        
        project_info = projects_dict.get(project_id, {})
        parent = project_info.get('parent', {})
        parent_id = parent.get('id')
        
        # 특정 프로젝트 하드코딩 레벨 설정
        if project_id == ATI_PROJECT_IDS['ATI_HEADQUARTERS']:  # 00. ATI 본사
            return 11
        elif project_id == ATI_PROJECT_IDS['ATI_SAMPLE_EVALUATION']:  # ATI 시료 평가
            return 21
        elif project_id == ATI_PROJECT_IDS['ATI_GUIDE']:  # PMS System 안내
            return 31
        
        # 레벨 설정 로직
        if parent_id is None:
            return 1  # 최상위 (고객사)
        elif parent_id == ATI_PROJECT_IDS['ATI_HEADQUARTERS']:  # 부모가 00. ATI 본사인 경우
            return 12
        elif not project_info.get('children_ids'):  # 자식이 없으면
            return 4  # 최하위 (설비/라인)
        elif parent_id in CUSTOMER_PROJECT_IDS:
            return 2  # 고객사의 직접 하위 (지역)
        else:
            return 3  # 지역의 하위 (건물명)


# ===== API 관련 메서드들 =====

    def get_user_api_key(self, login: str) -> Dict: # 수정 불가
        """사용자 API 키 조회"""
        try:
            conn = self.get_connection()
            if not conn:
                return {
                    "success": False,
                    "message": "DB 연결 실패"
                }
            
            cursor = conn.cursor()
            
            # 사용자 API 키 조회
            cursor.execute("""
                SELECT user_id, firstname, lastname, user_name, email, api_key_encrypted
                FROM user_api_keys 
                WHERE user_id = %s
            """, (login,))
            
            result = cursor.fetchone()
            
            if result:
                # API 키 복호화
                import base64
                encrypted_key = result[5]
                api_key = base64.b64decode(encrypted_key.encode()).decode()
                
                return {
                    "success": True,
                    "message": "API 키가 등록되어 있습니다.",
                    "data": {
                        "user_id": result[0],
                        "firstname": result[1],
                        "lastname": result[2],
                        "user_name": result[3],
                        "email": result[4],
                        "api_key": api_key
                    }
                }
            else:
                return {
                    "success": False,
                    "message": "등록된 API 키가 없습니다.",
                    "data": None
                }
                
        except Exception as e:
            return {
                "success": False,
                "message": f"API 키 조회 중 오류 발생: {str(e)}"
            }
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    def save_user_api_key(self, api_key: str) -> Dict: # 수정 불가
        """사용자 API 키 저장 (레드마인에서 사용자 정보 가져와서 저장)"""
        try:
            # 1. API 키로 레드마인에서 사용자 정보 가져오기
            import requests
            from config import REDMINE_URL
            
            headers = {'X-Redmine-API-Key': api_key}
            response = requests.get(f"{REDMINE_URL}/users/current.json", headers=headers, timeout=10)
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "message": "API 키가 유효하지 않습니다. 레드마인 연결을 확인해주세요."
                }
            
            user_data = response.json().get('user', {})
            user_id = user_data.get('login', '')  # login을 user_id로 사용
            firstname = user_data.get('firstname', '')
            lastname = user_data.get('lastname', '')
            user_email = f"{user_id}@ati2000.co.kr"  # login + @ati2000.co.kr
            
            # 이름 조합 (firstname + lastname)
            user_name = f"{firstname} {lastname}".strip()
            if not user_name:
                user_name = user_data.get('login', 'Unknown User')
            
            # 2. DB 연결
            conn = self.get_connection()
            if not conn:
                return {
                    "success": False,
                    "message": "DB 연결 실패"
                }
            
            cursor = conn.cursor()
            
            # 3. API 키 암호화
            import base64
            encrypted_key = base64.b64encode(api_key.encode()).decode()
            
            # 4. 기존 사용자 API 키가 있는지 확인 (user_id로 확인)
            cursor.execute("""
                SELECT id FROM user_api_keys 
                WHERE user_id = %s
            """, (user_id,))
            
            existing = cursor.fetchone()
            
            if existing:
                # 기존 데이터 업데이트
                cursor.execute("""
                    UPDATE user_api_keys 
                    SET firstname = %s, lastname = %s, user_name = %s, email = %s, api_key_encrypted = %s, updated_at = NOW()
                    WHERE user_id = %s
                """, (firstname, lastname, user_name, user_email, encrypted_key, user_id))
            else:
                # 새 데이터 삽입
                cursor.execute("""
                    INSERT INTO user_api_keys (user_id, firstname, lastname, user_name, email, api_key_encrypted, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                """, (user_id, firstname, lastname, user_name, user_email, encrypted_key))
            
            conn.commit()
            
            return {
                "success": True,
                "message": f"사용자 '{user_name}'의 API 키가 성공적으로 저장되었습니다.",
                "data": {
                    "user_id": user_id,
                    "firstname": firstname,
                    "lastname": lastname,
                    "user_name": user_name,
                    "email": user_email
                }
            }
            
        except requests.RequestException as e:
            return {
                "success": False,
                "message": f"레드마인 연결 실패: {str(e)}"
            }
        except Exception as e:
            if conn:
                conn.rollback()
            return {
                "success": False,
                "message": f"API 키 저장 중 오류 발생: {str(e)}"
            }
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()


# ===== 로드맵 관련 메서드들 =====

    def sync_roadmap_data(self) -> Dict: # 수정 불가
        """로드맵 데이터 동기화 - PMS에서 로드맵 정보를 가져와서 DB에 저장"""
        try:
            import requests
            from config import REDMINE_URL, API_KEY, CUSTOMER_PROJECT_IDS
            
            headers = {'X-Redmine-API-Key': API_KEY}
            saved_count = 0
            updated_count = 0
            total_versions = 0
            

            
            # DB 연결
            conn = self.get_connection()
            if not conn:
                return {
                    "success": False,
                    "error": "DB 연결 실패"
                }
            
            cursor = conn.cursor()
            
            # 기존 로드맵 데이터 모두 삭제
            cursor.execute("TRUNCATE TABLE roadmap_versions")
            
            # 각 고객사 프로젝트별로 로드맵 데이터 가져오기
            for project_id in CUSTOMER_PROJECT_IDS:
                try:
                    # 프로젝트 정보 가져오기
                    project_url = f"{REDMINE_URL}/projects/{project_id}.json"
                    project_response = requests.get(project_url, headers=headers, timeout=10)
                    
                    if project_response.status_code != 200:
                        continue
                    
                    project_data = project_response.json().get('project', {})
                    project_name = project_data.get('name', '')
                    project_identifier = project_data.get('identifier', '')
                    
                    # 프로젝트의 로드맵(버전) 정보 가져오기
                    versions_url = f"{REDMINE_URL}/projects/{project_identifier}/versions.json"
                    versions_response = requests.get(versions_url, headers=headers, timeout=10)
                    
                    if versions_response.status_code != 200:
                        continue
                    
                    versions_data = versions_response.json()
                    versions = versions_data.get('versions', [])
                    
                    for version in versions:
                        version_id = version.get('id')
                        version_name = version.get('name', '')
                        status = version.get('status', '')
                        description = version.get('description', '')
                        due_date = version.get('due_date')
                        created_on = version.get('created_on')
                        updated_on = version.get('updated_on')
                        wiki_page_title = version.get('wiki_page_title', '')
                        
                        # 위키 페이지 URL 생성
                        wiki_page_url = ""
                        if wiki_page_title:
                            wiki_page_url = f"{REDMINE_URL}/projects/{project_identifier}/wiki/{wiki_page_title}"
                        
                        # 연결된 일감 ID들 가져오기 (모든 일감)
                        connected_issue_ids = []
                        try:
                            # 모든 일감 가져오기 (진행중 + 완료 모두)
                            issues_url = f"{REDMINE_URL}/issues.json?fixed_version_id={version_id}&limit=100&status_id=*"
                            issues_response = requests.get(issues_url, headers=headers, timeout=10)
                            
                            if issues_response.status_code == 200:
                                issues_data = issues_response.json()
                                issues = issues_data.get('issues', [])
                                connected_issue_ids = [str(issue.get('id')) for issue in issues]
                        except:
                            pass  # 일감 조회 실패 시 무시
                        
                        # 쉼표로 구분된 ID 리스트로 변환
                        connected_issue_ids_str = ','.join(connected_issue_ids) if connected_issue_ids else ''
                        
                        # "기본설정" 또는 "기본 설정"인 경우 제외
                        if version_name.strip() in ["기본설정", "기본 설정"]:
                            continue
                        
                        # 새 데이터 삽입 (TRUNCATE 후이므로 항상 INSERT)
                        cursor.execute("""
                            INSERT INTO roadmap_versions 
                            (redmine_version_id, project_id, project_name, version_name, status, description,
                             due_date, created_on, updated_on, wiki_page_title, wiki_page_url, connected_issue_ids)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (version_id, project_id, project_name, version_name, status, description,
                              due_date, created_on, updated_on, wiki_page_title, wiki_page_url, connected_issue_ids_str))
                        saved_count += 1
                        
                        total_versions += 1
                
                except Exception as e:
                    continue
            
            conn.commit()
            
            return {
                "success": True,
                "message": f"로드맵 데이터 동기화 완료. 총 {total_versions}개 버전 처리됨",
                "count": total_versions,
                "saved": saved_count,
                "updated": 0  # TRUNCATE 방식이므로 updated는 항상 0
            }
            
        except Exception as e:
            if conn:
                conn.rollback()
            return {
                "success": False,
                "error": f"로드맵 데이터 동기화 실패: {str(e)}"
            }
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    def get_roadmap_by_status(self, status: str) -> Dict: # 수정 불가
        """상태별 로드맵 데이터 조회"""
        conn = self.get_connection()
        if not conn:
            return {
                "success": False,
                "message": "데이터베이스 연결 실패",
                "data": []
            }
        
        cursor = None
        try:
            cursor = conn.cursor(pymysql.cursors.DictCursor)
            
            # status 파라미터 검증
            if status not in ['open', 'closed']:
                return {
                    "success": False,
                    "message": "잘못된 status 값입니다. 'open' 또는 'closed'를 입력해주세요.",
                    "data": []
                }
            
            # 해당 status의 모든 로드맵 데이터 조회
            query = """
                SELECT id, redmine_version_id, project_id, project_name, version_name, 
                       status, description, due_date, created_on, updated_on, 
                       wiki_page_title, wiki_page_url, connected_issue_ids,
                       created_at, updated_at
                FROM roadmap_versions 
                WHERE status = %s
                ORDER BY created_on DESC
            """
            
            cursor.execute(query, (status,))
            results = cursor.fetchall()
            
            # 결과 데이터 정리
            roadmap_data = []
            for row in results:
                roadmap_item = {
                    "id": row.get('id'),
                    "redmine_version_id": row.get('redmine_version_id'),
                    "project_id": row.get('project_id'),
                    "project_name": row.get('project_name'),
                    "version_name": row.get('version_name'),
                    "status": row.get('status'),
                    "description": row.get('description'),
                    "due_date": row.get('due_date'),
                    "created_on": row.get('created_on'),
                    "updated_on": row.get('updated_on'),
                    "wiki_page_title": row.get('wiki_page_title'),
                    "wiki_page_url": row.get('wiki_page_url'),
                    "connected_issue_ids": row.get('connected_issue_ids'),
                    "created_at": row.get('created_at'),
                    "updated_at": row.get('updated_at')
                }
                roadmap_data.append(roadmap_item)
            
            return {
                "success": True,
                "message": f"{status} 상태의 로드맵 데이터 조회 완료",
                "data": roadmap_data,
                "count": len(roadmap_data)
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"로드맵 데이터 조회 실패: {str(e)}",
                "data": []
            }
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    def get_roadmap_by_project_id(self, project_id: int) -> Dict: # 수정 불가
        """프로젝트 ID별 로드맵 데이터 조회"""
        conn = self.get_connection()
        if not conn:
            return {
                "success": False,
                "message": "데이터베이스 연결 실패",
                "data": []
            }
        
        cursor = None
        try:
            cursor = conn.cursor(pymysql.cursors.DictCursor)
            
            # 해당 프로젝트 ID의 모든 로드맵 데이터 조회
            query = """
                SELECT id, redmine_version_id, project_id, project_name, version_name, 
                       status, description, due_date, created_on, updated_on, 
                       wiki_page_title, wiki_page_url, connected_issue_ids,
                       created_at, updated_at
                FROM roadmap_versions 
                WHERE project_id = %s
                ORDER BY created_on DESC
            """
            
            cursor.execute(query, (project_id,))
            results = cursor.fetchall()
            
            # 결과 데이터 정리
            roadmap_data = []
            for row in results:
                roadmap_item = {
                    "id": row.get('id'),
                    "redmine_version_id": row.get('redmine_version_id'),
                    "project_id": row.get('project_id'),
                    "project_name": row.get('project_name'),
                    "version_name": row.get('version_name'),
                    "status": row.get('status'),
                    "description": row.get('description'),
                    "due_date": row.get('due_date'),
                    "created_on": row.get('created_on'),
                    "updated_on": row.get('updated_on'),
                    "wiki_page_title": row.get('wiki_page_title'),
                    "wiki_page_url": row.get('wiki_page_url'),
                    "connected_issue_ids": row.get('connected_issue_ids'),
                    "created_at": row.get('created_at'),
                    "updated_at": row.get('updated_at')
                }
                roadmap_data.append(roadmap_item)
            
            return {
                "success": True,
                "message": f"프로젝트 ID {project_id}의 로드맵 데이터 조회 완료",
                "data": roadmap_data,
                "count": len(roadmap_data)
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"로드맵 데이터 조회 실패: {str(e)}",
                "data": []
            }
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()