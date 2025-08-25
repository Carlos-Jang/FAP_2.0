"""
FAP 2.0 - 이슈 데이터베이스 API 라우터 (백엔드)

주요 기능:
- 이슈 데이터 조회 및 분석: 통계, 진행률, 유형별 분석
- 프로젝트 계층 탐색: SITE → Sub Site → Product 구조 관리
- 실시간 상태 변경: 드래그 앤 드롭으로 이슈 상태 업데이트
- 다중 선택 처리: 여러 항목 동시 선택 시 데이터 통합

API 엔드포인트:
- /site: 고객사 프로젝트 목록 조회
- /sub-site: 하위 사이트 목록 조회
- /sub-sites: 다중 사이트 선택 처리
- /summary: 요약 통계 데이터
- /progress: 진행률 데이터
- /type: 유형별 분석 데이터
- /member: 인원별 분석 데이터
- /hw: HW 관련 데이터
- /sw: SW 관련 데이터
- /update-issue-status: 이슈 상태 업데이트

기술 스택:
- FastAPI
- MariaDB (DatabaseManager)
- Redmine API 연동
- 실시간 데이터 처리
"""

from fastapi import APIRouter, Query, HTTPException, Request
from typing import List, Dict, Optional
from db_manager import DatabaseManager
from config import CUSTOMER_PROJECT_IDS
from redmine_service import update_issue_status

import json
import re




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


def get_member_best_work_data(issues: List[Dict]) -> Dict: # 수정 불가
    """최고 성과 멤버 상세 데이터 계산 헬퍼 함수"""
    # [AE]BEST 작업인 이슈들 필터링
    best_issues = [issue for issue in issues if issue.get('status_name') == '[AE]BEST 작업']
    
    # 필요한 정보 추출
    best_member_data = []
    for issue in best_issues:
        best_member_data.append({
            'author': issue.get('author_name', ''),
            'product': issue.get('product', ''),
            'issue_id': issue.get('redmine_id', ''),
            'subject': issue.get('subject', '')
        })
    
    return {
        "type": "best_member_data",
        "data": best_member_data
    }

def get_member_best_work_summary(issues: List[Dict]) -> Dict: # 수정 불가
    """최고 성과 멤버 요약 데이터 계산 헬퍼 함수"""
    # [AE]BEST 작업인 이슈들 필터링
    best_issues = [issue for issue in issues if issue.get('status_name') == '[AE]BEST 작업']
    
    # 작성자별 BEST 작업 건수 카운트
    author_counts = {}
    for issue in best_issues:
        author_name = issue.get('author_name', '')
        if author_name:
            author_counts[author_name] = author_counts.get(author_name, 0) + 1
    
    # 요약 데이터 생성
    best_member_summary = []
    for author_name, count in author_counts.items():
        best_member_summary.append({
            'author': author_name,
            'count': count
        })
    
    # 건수 기준으로 내림차순 정렬
    best_member_summary.sort(key=lambda x: x['count'], reverse=True)
    
    return {
        "type": "best_member_summary",
        "data": best_member_summary
    }

def get_member_issue_type(issues: List[Dict]) -> Dict: # 수정 불가
    """멤버별 이슈 타입 데이터 조회"""
    # 작성자별 통계 계산
    member_stats = {}
    
    for issue in issues:
        author_name = issue.get('author_name', 'Unknown')
        tracker_name = issue.get('tracker_name', 'Unknown')
        is_closed = issue.get('is_closed', 0)
        
        # tracker_name에서 대괄호 제거하고 깔끔한 이름으로 변환
        clean_tracker_name = tracker_name.replace('[AE][이슈] ', '').replace('[AE][Setup] ', '').replace('[AE] ', '')
        
        if author_name not in member_stats:
            member_stats[author_name] = {
                'total_tasks': 0,
                'in_progress_tasks': 0,
                'completed_tasks': 0,
                'completion_rate': 0,
                'in_progress_types': {},
                'completed_types': {}
            }
        
        # 전체 작업 수 증가
        member_stats[author_name]['total_tasks'] += 1
        
        # 완료/진행중 작업 분류
        if is_closed == 1:
            member_stats[author_name]['completed_tasks'] += 1
            # 완료 작업 유형 카운트
            if clean_tracker_name not in member_stats[author_name]['completed_types']:
                member_stats[author_name]['completed_types'][clean_tracker_name] = 0
            member_stats[author_name]['completed_types'][clean_tracker_name] += 1
        else:
            member_stats[author_name]['in_progress_tasks'] += 1
            # 진행중 작업 유형 카운트
            if clean_tracker_name not in member_stats[author_name]['in_progress_types']:
                member_stats[author_name]['in_progress_types'][clean_tracker_name] = 0
            member_stats[author_name]['in_progress_types'][clean_tracker_name] += 1
    
    # 완료율 계산
    for author_name, stats in member_stats.items():
        if stats['total_tasks'] > 0:
            stats['completion_rate'] = round((stats['completed_tasks'] / stats['total_tasks']) * 100, 1)
    
    # 결과 데이터 구성
    member_issue_data = []
    for author_name, stats in member_stats.items():
        # 진행중 작업 유형 텍스트 생성
        in_progress_text_parts = []
        for tracker_name, count in stats['in_progress_types'].items():
            # tracker별 고정 색상 매핑
            if 'HW' in tracker_name:
                color = '#FF6B6B'  # 빨간색
            elif 'SW' in tracker_name:
                color = '#4CAF50'  # 초록색
            elif 'AE' in tracker_name:
                color = '#2196F3'  # 파란색
            else:
                color = '#222222'  # 검정색
            
            in_progress_text_parts.append(f'<span style="color: {color}">{tracker_name}: {count}건</span>')
        
        in_progress_text = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;".join(in_progress_text_parts) if in_progress_text_parts else "없음"
        
        # 완료 작업 유형 텍스트 생성
        completed_text_parts = []
        for tracker_name, count in stats['completed_types'].items():
            # tracker별 고정 색상 매핑
            if 'HW' in tracker_name:
                color = '#FF6B6B'  # 빨간색
            elif 'SW' in tracker_name:
                color = '#4CAF50'  # 초록색
            elif 'AE' in tracker_name:
                color = '#2196F3'  # 파란색
            else:
                color = '#222222'  # 검정색
            
            completed_text_parts.append(f'<span style="color: {color}">{tracker_name}: {count}건</span>')
        
        completed_text = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;".join(completed_text_parts) if completed_text_parts else "없음"
        
        # 해당 작업자의 Product별 상세 일감 정보 수집
        products_data = {}
        for issue in issues:
            if issue.get('author_name') == author_name:
                product = issue.get('product', 'Unknown')
                if product not in products_data:
                    products_data[product] = []
                
                products_data[product].append({
                    'redmine_id': issue.get('redmine_id'),
                    'subject': issue.get('subject'),
                    'tracker_name': issue.get('tracker_name'),
                    'status_name': issue.get('status_name'),
                    'created_date': issue.get('created_at'),
                    'updated_date': issue.get('updated_at'),
                    'description': issue.get('description'),
                    'is_closed': issue.get('is_closed')
                })
        
        member_issue_data.append({
            'worker': author_name,
            'total_tasks': stats['total_tasks'],
            'in_progress_tasks': stats['in_progress_tasks'],
            'completed_tasks': stats['completed_tasks'],
            'completion_rate': stats['completion_rate'],
            'in_progress_types': in_progress_text,
            'completed_types': completed_text,
            'products': products_data  # Product별 상세 일감 정보 추가
        })
    
    # 전체 작업 수로 정렬 (내림차순)
    member_issue_data.sort(key=lambda x: x['total_tasks'], reverse=True)
    
    return {
        "type": "member_issue_type",
        "title": "작업자별 이슈 유형",
        "data": member_issue_data
    }

def get_type_data_count(issues: List[Dict]) -> Dict: # 수정 불가
    """이슈 데이터를 받아서 유형별 통계를 생성하는 헬퍼 함수"""
    
    # tracker_name별 카운팅
    tracker_counts = {}
    
    for issue in issues:
        tracker_name = issue.get('tracker_name', 'Unknown')
        tracker_counts[tracker_name] = tracker_counts.get(tracker_name, 0) + 1
    
    return {
        "tracker_counts": tracker_counts
    }

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

def get_progress_summary(issues: List[Dict]) -> Dict: # 수정 불가
    """이슈 데이터를 받아서 진행률 요약 정보를 생성하는 헬퍼 함수"""
    
    # 업무 유형별로 그룹화
    tracker_groups = {}
    
    for issue in issues:
        tracker_name = issue.get('tracker_name', 'Unknown')
        status_name = issue.get('status_name', 'Unknown')
        is_closed = issue.get('is_closed', 0)
        
        # [사내]가 포함된 tracker는 그룹화하지 않음
        if '[사내]' in tracker_name:
            continue
        
        if tracker_name not in tracker_groups:
            tracker_groups[tracker_name] = {}
        
        if status_name not in tracker_groups[tracker_name]:
            tracker_groups[tracker_name][status_name] = {
                'total': 0,
                'completed': 0,
                'in_progress': 0
            }
        
        tracker_groups[tracker_name][status_name]['total'] += 1
        if is_closed == 1:
            tracker_groups[tracker_name][status_name]['completed'] += 1
        else:
            tracker_groups[tracker_name][status_name]['in_progress'] += 1
    
    # 결과 데이터 구성
    progress_data = []
    
    for tracker_name, status_groups in tracker_groups.items():
        tracker_total = 0
        tracker_completed = 0
        
        status_details = []
        for status_name, stats in status_groups.items():
            tracker_total += stats['total']
            tracker_completed += stats['completed']
            
            status_details.append({
                'status_name': status_name,
                'total_count': stats['total'],
                'completed_count': stats['completed'],
                'in_progress_count': stats['in_progress']
            })
        
        tracker_completion_rate = (tracker_completed / tracker_total * 100) if tracker_total > 0 else 0
        
        progress_data.append({
            'tracker_name': tracker_name,
            'total_count': tracker_total,
            'completed_count': tracker_completed,
            'in_progress_count': tracker_total - tracker_completed,
            'completion_rate': round(tracker_completion_rate, 1),
            'status_details': status_details
        })
    
    # 전체 갯수 기준으로 정렬 (내림차순)
    progress_data.sort(key=lambda x: x['total_count'], reverse=True)
    
    return {
        "progress_data": progress_data
    }

def get_progress_detail(issues: List[Dict]) -> Dict: # 수정 불가
    """이슈 데이터를 받아서 진행률 상세 정보를 생성하는 헬퍼 함수"""
    
    # 업무 유형별로 그룹화
    tracker_details = {}
    
    for issue in issues:
        tracker_name = issue.get('tracker_name', 'Unknown')
        status_name = issue.get('status_name', 'Unknown')
        assigned_to = issue.get('assigned_to', '미지정')
        subject = issue.get('subject', '제목 없음')
        description = issue.get('description', '내용 없음')
        redmine_id = issue.get('redmine_id', 0)
        
        if tracker_name not in tracker_details:
            tracker_details[tracker_name] = {}
        
        if status_name not in tracker_details[tracker_name]:
            tracker_details[tracker_name][status_name] = []
        
        tracker_details[tracker_name][status_name].append({
            'assigned_to': assigned_to,
            'subject': subject,
            'description': description,
            'status_name': status_name,
            'redmine_id': redmine_id,
            'author_name': issue.get('author_name', '미지정')
        })
    
    # 결과 데이터 구성
    detail_data = []
    

    
    for tracker_name, status_groups in tracker_details.items():
        tracker_detail = {
            'tracker_name': tracker_name,
            'status_details': []
        }
        
        # tracker_name에 따른 status_order 설정
        current_status_order = []
        if tracker_name == '[AE][이슈] AE Part':
            current_status_order = [
                '[AE][운영]이슈 등록',
                '[AE][운영] 문제 조치', 
                '[AE][운영] 확산 적용',
                '[AE][운영] 조치 완료',
                '[AE]BEST 작업'
            ]
        elif tracker_name == '[AE][이슈] HW Part':
            current_status_order = [
                '[AE][HW] 이슈 등록',
                '[AE][HW] 개선 방향 협의',
                '[AE][HW] 문제 조치',
                '[AE][HW] 확산',
                '[AE][HW] 조치 완료',
                '[AE]BEST 작업'
            ]
        elif tracker_name == '[AE][이슈] SW Part':
            current_status_order = [
                '[AE][SW] 이슈 등록',
                '[AE][SW] 개선 방향 협의',
                '[사내][SW] 개발',
                '[사내][SW] 개발 완료',
                '[AE][SW] 현장 적용',
                '[AE][SW] 확산 Patch',
                '[AE][SW] 조치 완료',
                '[AE]BEST 작업'
            ]
        elif tracker_name == '[AE][Setup] 이설 Setup':
            current_status_order = [
                '[AE][Setup] 반입&레벨링',
                '[AE][Setup] 기초 Setup',
                '[AE][Setup] TTTM',
                '[AE][Setup] 자동화',
                '[AE][Setup] Setup 완료'
            ]
        elif tracker_name == '[AE][Setup] 초기 Setup':
            current_status_order = [
                '[AE][Setup] 반입&레벨링',
                '[AE][Setup] 기초 Setup',
                '[AE][Setup] TTTM',
                '[AE][Setup] 자동화',
                '[AE][Setup] Setup 완료'
            ]
        elif tracker_name == '[AE] 확산 적용':
            current_status_order = [
                '[AE][확산] 확산 시작',
                '[AE][확산] 확산 완료'
            ]
        
        # 정의된 순서대로 status_details 정렬 (카운트가 0이어도 출력)
        for status_name in current_status_order:
            status_detail = {
                'status_name': status_name,
                'issues': status_groups.get(status_name, [])  # 없으면 빈 배열
            }
            tracker_detail['status_details'].append(status_detail)
        
        # 정의되지 않은 status_name들도 추가 (순서 뒤에)
        for status_name, issues in status_groups.items():
            if status_name not in current_status_order:
                status_detail = {
                    'status_name': status_name,
                    'issues': issues
                }
                tracker_detail['status_details'].append(status_detail)
        
        detail_data.append(tracker_detail)
    
    return {
        "progress_detail": detail_data
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

def get_issue_project_ids(site_index: int, sub_site_name: str, product_name: str) -> List[int]:  # 수정 불가
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
                            # Level 4라면 Product 이름이 정확히 일치하는지 확인
                            project_name = project.get('project_name', '')
                            project_name_code = project_name
                            # #01 앞부분만 추출
                            match = re.match(r'^(.+?)\s+#\d+', project_name_code)
                            if match:
                                project_name_code = match.group(1).strip()
                            
                            if product_name == project_name_code:
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
                                project_name_code = project_name
                                # #01 앞부분만 추출
                                match = re.match(r'^(.+?)\s+#\d+', project_name_code)
                                if match:
                                    project_name_code = match.group(1).strip()
                                
                                if product_name == project_name_code:
                                    all_product_ids.append(project.get('redmine_project_id'))
                
                return all_product_ids
        else:
            # 일반 Sub Site인 경우
            if product_name == "ALL":
                # Sub Site가 있고 Product가 ALL인 경우
                projects = db.get_projects_by_name(sub_site_name)
                
                if not projects or len(projects) == 0:
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
                        # Level 4라면 Product 이름이 정확히 일치하는지 확인
                        project_name = project.get('project_name', '')
                        project_name_code = project_name
                        # #01 앞부분만 추출
                        match = re.match(r'^(.+?)\s+#\d+', project_name_code)
                        if match:
                            project_name_code = match.group(1).strip()
                        
                        if product_name == project_name_code:
                            # Product 이름이 정확히 일치하는 경우 해당 ID 저장
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
                        # Level 4라면 Product 이름이 정확히 일치하는지 확인
                        project_name = project.get('project_name', '')
                        project_name_code = project_name
                        # #01 앞부분만 추출
                        match = re.match(r'^(.+?)\s+#\d+', project_name_code)
                        if match:
                            project_name_code = match.group(1).strip()
                        
                        if product_name == project_name_code:
                            # Product 이름이 정확히 일치하는 경우 해당 ID 저장
                            products.append(project.get('redmine_project_id'))
                
                return products
        
    except Exception as e:
        return []

def get_hw_equipment_analysis(issues: List[Dict]) -> Dict: # 수정 불가
    """설비군별 HW 부품 문제 분석 헬퍼 함수"""
    # HW 이슈만 필터링
    hw_issues = [issue for issue in issues if issue.get('tracker_name') == '[AE][이슈] HW Part']
    
    if not hw_issues:
        return {}
    
    # 설비군별로 그룹화
    equipment_analysis = {}
    
    for issue in hw_issues:
        product_name = issue.get('product', 'Unknown')
        raw_data = issue.get('raw_data', '{}')
        
        try:
            raw_dict = json.loads(raw_data)
            custom_fields = raw_dict.get('custom_fields', [])
            
            # 설비군별 데이터 초기화
            if product_name not in equipment_analysis:
                equipment_analysis[product_name] = {
                    'total_hw_issues': 0,
                    'hw_components': [],
                    'hw_issues': []
                }
            
            equipment_analysis[product_name]['total_hw_issues'] += 1
            
            # [HW]와 [Optic] 태그가 붙은 필드들 찾기
            hw_values = []
            for field in custom_fields:
                field_name = field.get('name', '')
                field_value = field.get('value', '')
                
                # [HW] 또는 [Optic] 태그가 있고 값이 있는 경우
                if ('[HW]' in field_name or '[Optic]' in field_name) and field_value:
                    hw_values.append(field_value)
            
            # HW 관련 값들을 설비군에 추가
            if hw_values:
                equipment_analysis[product_name]['hw_components'].extend(hw_values)
            else:
                # HW 값이 없으면 "없음" 추가
                equipment_analysis[product_name]['hw_components'].append("없음")
            
            # HW 이슈 상세 정보 추가
            issue_detail = {
                'redmine_id': issue.get('redmine_id'),
                'subject': issue.get('subject', ''),
                'hw_components': hw_values,
                'is_closed': issue.get('is_closed', 0),
                'description': issue.get('description', '')
            }
            equipment_analysis[product_name]['hw_issues'].append(issue_detail)
                    
        except json.JSONDecodeError:
            continue
    
    return equipment_analysis

def get_hw_overview_summary(issues: List[Dict]) -> Dict: # 수정 불가
    """HW 이슈 전체 요약 정보 생성 헬퍼 함수"""
    # HW 이슈만 필터링
    hw_issues = [issue for issue in issues if issue.get('tracker_name') == '[AE][이슈] HW Part']
    
    if not hw_issues:
        return {
            "total_hw_issues": 0,
            "total_equipment": 0,
            "completion_rate": 0,
            "equipment_summary": {}
        }
    
    # 전체 HW 이슈 통계
    total_hw_issues = len(hw_issues)
    completed_hw_issues = sum(1 for issue in hw_issues if issue.get('is_closed') == 1)
    completion_rate = round((completed_hw_issues / total_hw_issues * 100), 1) if total_hw_issues > 0 else 0
    
    # 설비군별 전체 이슈 vs HW 이슈 비교
    equipment_summary = {}
    
    # 모든 이슈를 설비군별로 그룹화
    all_equipment_issues = {}
    for issue in issues:
        product_name = issue.get('product', 'Unknown')
        if product_name not in all_equipment_issues:
            all_equipment_issues[product_name] = []
        all_equipment_issues[product_name].append(issue)
    
    # HW 이슈를 설비군별로 그룹화
    hw_equipment_issues = {}
    for issue in hw_issues:
        product_name = issue.get('product', 'Unknown')
        if product_name not in hw_equipment_issues:
            hw_equipment_issues[product_name] = []
        hw_equipment_issues[product_name].append(issue)
    
    # 설비군별 요약 정보 생성
    for equipment in all_equipment_issues.keys():
        total_issues = len(all_equipment_issues[equipment])
        hw_issues_count = len(hw_equipment_issues.get(equipment, []))
        hw_ratio = round((hw_issues_count / total_issues * 100), 1) if total_issues > 0 else 0
        
        # HW 이슈 중 완료된 것 계산
        completed_hw = sum(1 for issue in hw_equipment_issues.get(equipment, []) if issue.get('is_closed') == 1)
        hw_completion_rate = round((completed_hw / hw_issues_count * 100), 1) if hw_issues_count > 0 else 0
        
        equipment_summary[equipment] = {
            "total": total_issues,
            "hw": hw_issues_count,
            "hw_ratio": hw_ratio,
            "hw_completion_rate": hw_completion_rate
        }
    
    # 전체 이슈 대비 HW 이슈 비율 계산
    total_all_issues = len(issues)
    hw_ratio = round((total_hw_issues / total_all_issues * 100), 1) if total_all_issues > 0 else 0
    
    return {
        "total_hw_issues": total_hw_issues,
        "total_all_issues": total_all_issues,
        "hw_ratio": hw_ratio,
        "completion_rate": completion_rate,
        "equipment_summary": equipment_summary
    }

def get_sw_overview_summary(issues: List[Dict]) -> Dict: # 수정 불가
    """SW 이슈 전체 요약 정보 생성 헬퍼 함수"""
    # SW 이슈만 필터링
    sw_issues = [issue for issue in issues if issue.get('tracker_name') == '[AE][이슈] SW Part']
    
    if not sw_issues:
        return {
            "total_sw_issues": 0,
            "total_equipment": 0,
            "completion_rate": 0,
            "equipment_summary": {}
        }
    
    # 전체 SW 이슈 통계
    total_sw_issues = len(sw_issues)
    completed_sw_issues = sum(1 for issue in sw_issues if issue.get('is_closed') == 1)
    completion_rate = round((completed_sw_issues / total_sw_issues * 100), 1) if total_sw_issues > 0 else 0
    
    # 설비군별 전체 이슈 vs SW 이슈 비교
    equipment_summary = {}
    
    # 모든 이슈를 설비군별로 그룹화
    all_equipment_issues = {}
    for issue in issues:
        product_name = issue.get('product', 'Unknown')
        if product_name not in all_equipment_issues:
            all_equipment_issues[product_name] = []
        all_equipment_issues[product_name].append(issue)
    
    # SW 이슈를 설비군별로 그룹화
    sw_equipment_issues = {}
    for issue in sw_issues:
        product_name = issue.get('product', 'Unknown')
        if product_name not in sw_equipment_issues:
            sw_equipment_issues[product_name] = []
        sw_equipment_issues[product_name].append(issue)
    
    # 설비군별 요약 정보 생성
    for equipment in all_equipment_issues.keys():
        total_issues = len(all_equipment_issues[equipment])
        sw_issues_count = len(sw_equipment_issues.get(equipment, []))
        sw_ratio = round((sw_issues_count / total_issues * 100), 1) if total_issues > 0 else 0
        
        # SW 이슈 중 완료된 것 계산
        completed_sw = sum(1 for issue in sw_equipment_issues.get(equipment, []) if issue.get('is_closed') == 1)
        sw_completion_rate = round((completed_sw / sw_issues_count * 100), 1) if sw_issues_count > 0 else 0
        
        equipment_summary[equipment] = {
            "total": total_issues,
            "sw": sw_issues_count,
            "sw_ratio": sw_ratio,
            "sw_completion_rate": sw_completion_rate
        }
    
    # 전체 이슈 대비 SW 이슈 비율 계산
    total_all_issues = len(issues)
    sw_ratio = round((total_sw_issues / total_all_issues * 100), 1) if total_all_issues > 0 else 0
    
    return {
        "total_sw_issues": total_sw_issues,
        "total_all_issues": total_all_issues,
        "sw_ratio": sw_ratio,
        "completion_rate": completion_rate,
        "equipment_summary": equipment_summary
    }

def get_sw_detail_analysis(issues: List[Dict]) -> Dict: # 수정 불가
    """SW 이슈 상세 분석 헬퍼 함수"""
    # SW 이슈만 필터링
    sw_issues = [issue for issue in issues if issue.get('tracker_name') == '[AE][이슈] SW Part']
    
    if not sw_issues:
        return {}
    
    # 설비군별로 그룹화
    equipment_analysis = {}
    
    for issue in sw_issues:
        product_name = issue.get('product', 'Unknown')
        
        # 설비군별 데이터 초기화
        if product_name not in equipment_analysis:
            equipment_analysis[product_name] = {
                'total_sw_issues': 0,
                'project_groups': {}
            }
        
        equipment_analysis[product_name]['total_sw_issues'] += 1
        
        # Project ID로 그룹화
        project_id = issue.get('project_id', 'Unknown')
        
        # Project ID별 그룹 초기화
        if project_id not in equipment_analysis[product_name]['project_groups']:
            # 프로젝트 이름에서 #태그 뒷부분만 추출하고 첫 번째 단어를 파란색으로 처리
            original_project_name = issue.get('project_name', '')
            processed_project_name = original_project_name
            
            # #숫자 패턴 이후부터 추출
            import re
            match = re.search(r'#\d+\s*(.+)', original_project_name)
            if match:
                processed_project_name = match.group(1).strip()
            
            # 첫 번째 단어는 파란색, 두 번째 단어는 엔터, 그 이후는 그대로
            if processed_project_name:
                words = processed_project_name.split()
                if len(words) >= 1:
                    first_word = f'<span style="color: #007bff; font-weight: 600;">{words[0]}</span>'
                    if len(words) >= 2:
                        second_word = f'<br/>{words[1]}'
                        remaining_words = ' '.join(words[2:]) if len(words) > 2 else ''
                        processed_project_name = f'{first_word}{second_word} {remaining_words}'.strip()
                    else:
                        processed_project_name = first_word
                else:
                    processed_project_name = ''
            
            equipment_analysis[product_name]['project_groups'][project_id] = {
                'total_issues': 0,
                'project_name': processed_project_name,
                'sw_issues': []
            }
        
        equipment_analysis[product_name]['project_groups'][project_id]['total_issues'] += 1
        
        # SW 이슈 상세 정보 추가
        issue_detail = {
            'redmine_id': issue.get('redmine_id'),
            'subject': issue.get('subject', ''),
            'is_closed': issue.get('is_closed', 0),
            'description': issue.get('description', ''),
            'created_on': issue.get('created_at', ''),
            'updated_on': issue.get('updated_at', ''),
            'author_name': issue.get('author_name', ''),
            'status': issue.get('status', ''),
            'project_id': project_id,
            'project_name': issue.get('project_name', '')
        }
        equipment_analysis[product_name]['project_groups'][project_id]['sw_issues'].append(issue_detail)
    
    return equipment_analysis

router = APIRouter(prefix="/api/issues", tags=["issues"])



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
async def get_summary_report(request: Request): # 수정 불가
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
        
        # project_ids와 기간을 가지고 이슈 데이터 조회
        db = DatabaseManager()
        issues = db.get_issues_by_filter(start_date, end_date, all_project_ids)
        
        # 진행률 요약 블럭과 유형별 상세 현황 블럭 생성
        progress_summary = get_progress_summary(issues)
        type_data_list = get_type_data_list(issues)
        blocks = [
            {"type": "progress_summary", "data": progress_summary},
            {"type": "type_data_list", "data": type_data_list}
        ]
        
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
async def get_progress_data(request: Request): # 수정 불가
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
        
        # project_ids와 기간을 가지고 이슈 데이터 조회
        db = DatabaseManager()
        issues = db.get_issues_by_filter(start_date, end_date, all_project_ids)
        
        # 진행율 데이터 로직 구현
        progress_summary = get_progress_summary(issues)
        progress_detail = get_progress_detail(issues)
        
        # 블럭 구조로 데이터 구성
        blocks = [
            {
                "type": "progress_summary",
                "data": progress_summary
            },
            {
                "type": "progress_detail",
                "data": progress_detail
            }
        ]

        return {
            "success": True,
            "data": {
                "blocks": blocks
            }
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"진행율 데이터 조회 실패: {str(e)}")


@router.post("/get-type-data")
async def get_type_data(request: Request): # 수정 불가
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
        
        # project_ids와 기간을 가지고 이슈 데이터 조회
        db = DatabaseManager()
        issues = db.get_issues_by_filter(start_date, end_date, all_project_ids)
        
        # 유형 데이터 로직 구현
        type_data_count = get_type_data_count(issues)
        type_data_list = get_type_data_list(issues)

        # 블럭 구조로 데이터 구성
        blocks = [
            {
                "type": "type_data",
                "data": type_data_count
            },
            {
                "type": "type_data_list",
                "data": type_data_list
            }
        ]

        return {
            "success": True,
            "data": {
                "blocks": blocks
            }
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"유형 데이터 조회 실패: {str(e)}")


@router.post("/get-member-data")
async def get_member_data(request: Request): # 수정 불가
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

        # 선택된 리스트들 로그 출력
        
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
        
        # project_ids와 기간을 가지고 이슈 데이터 조회
        db = DatabaseManager()
        issues = db.get_issues_by_filter(start_date, end_date, all_project_ids)

        # TODO: 인원 데이터 로직 구현
        best_member_data = get_member_best_work_data(issues)
        best_member_summary = get_member_best_work_summary(issues)
        member_issue_type = get_member_issue_type(issues)
        
        # 블럭 리스트 초기화 (향후 여러 블럭 추가 가능)
        blocks = []
        blocks.append(best_member_summary)  # 요약을 먼저
        blocks.append(best_member_data)     # 상세 리스트를 나중에
        blocks.append(member_issue_type)    # 이슈 타입 데이터

        return {
            "success": True,
            "data": {
                "blocks": blocks
            }
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"인원 데이터 조회 실패: {str(e)}")

@router.post("/get-hw-data")
async def get_hw_data(request: Request): # 수정 불가
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
        # 선택된 리스트들 로그 출력
        
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
        
        # project_ids와 기간을 가지고 이슈 데이터 조회
        db = DatabaseManager()
        issues = db.get_issues_by_filter(start_date, end_date, all_project_ids)
        
        # HW 데이터 분석
        hw_equipment_analysis = get_hw_equipment_analysis(issues)
        hw_overview_summary = get_hw_overview_summary(issues)
        

        # 블럭 리스트 초기화
        blocks = []
        
        # HW 전체 요약 블럭 추가 (먼저 표시)
        if hw_overview_summary and hw_overview_summary['total_hw_issues'] > 0:
            hw_overview_block = {
                "type": "hw_overview",
                "title": "HW 이슈 전체 요약",
                "data": hw_overview_summary
            }
            blocks.append(hw_overview_block)
        
        # HW 설비군별 분석 블럭 추가
        if hw_equipment_analysis:
            hw_summary_block = {
                "type": "hw_summary",
                "title": "HW 설비군별 분석",
                "data": hw_equipment_analysis
            }
            blocks.append(hw_summary_block)

        return {
            "success": True,
            "data": {
                "blocks": blocks
            }
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HW 데이터 조회 실패: {str(e)}")


@router.post("/get-sw-data")
async def get_sw_data(request: Request): # 수정 불가
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
        # 선택된 리스트들 로그 출력
        
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
        
        # project_ids와 기간을 가지고 이슈 데이터 조회
        db = DatabaseManager()
        issues = db.get_issues_by_filter(start_date, end_date, all_project_ids)
        
        # SW 데이터 분석
        sw_overview_summary = get_sw_overview_summary(issues)
        sw_detail_analysis = get_sw_detail_analysis(issues)
        

        # 블럭 리스트 초기화
        blocks = []
        
        # SW 전체 요약 블럭 추가 (먼저 표시)
        if sw_overview_summary and sw_overview_summary['total_sw_issues'] > 0:
            sw_overview_block = {
                "type": "sw_overview",
                "title": "SW 이슈 전체 요약",
                "data": sw_overview_summary
            }
            blocks.append(sw_overview_block)
        
        # SW 설비군별 분석 블럭 추가
        if sw_detail_analysis:
            sw_summary_block = {
                "type": "sw_summary",
                "title": "SW 설비군별 분석",
                "data": sw_detail_analysis
            }
            blocks.append(sw_summary_block)

        return {
            "success": True,
            "data": {
                "blocks": blocks
            }
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SW 데이터 조회 실패: {str(e)}")

@router.put("/update-progress-status")
async def update_progress_status(request: Request): # 수정 불가
    """이슈 진행 상태 업데이트 API"""
    try:
        data = await request.json()
        redmine_id = data.get('redmine_id')
        old_status_name = data.get('old_status_name')
        new_status_name = data.get('new_status_name')
        user_id = data.get('user_id')  # 프론트에서 전달받은 사용자 ID

        if not all([redmine_id, old_status_name, new_status_name, user_id]):
            raise HTTPException(status_code=400, detail="필수 파라미터가 누락되었습니다: redmine_id, old_status_name, new_status_name, user_id")

        # DB 매니저를 통한 API 키 조회
        db = DatabaseManager()
        user_data = db.get_user_api_key(user_id)
        
        if not user_data.get("success"):
            raise HTTPException(status_code=400, detail="API 키가 등록되지 않았습니다. Setting 페이지에서 API 키를 등록해주세요.")
        
        api_key = user_data.get("data", {}).get("api_key")
        if not api_key:
            raise HTTPException(status_code=400, detail="API 키를 가져올 수 없습니다.")

        # 1. 레드마인 API 호출해서 실제 이슈 상태 변경 시도
        redmine_result = update_issue_status(redmine_id, old_status_name, new_status_name, api_key)
        
        if not redmine_result.get("success"):
            raise HTTPException(status_code=400, detail=f"레드마인 업데이트 실패: {redmine_result.get('message')}")
        
        # 2. 레드마인에서 실제 상태 재확인 (권한 문제 등으로 실제 변경되지 않았을 수 있음)
        from redmine_service import fetch_redmine_issue
        updated_issue = fetch_redmine_issue(redmine_id)
        
        if not updated_issue:
            raise HTTPException(status_code=400, detail="이슈 정보를 가져올 수 없습니다.")
        
        actual_status_name = updated_issue.get("status", {}).get("name", "")
        
        # 3. 실제 상태가 변경되었는지 확인
        if actual_status_name != new_status_name:
            raise HTTPException(status_code=400, detail=f"권한이 없어 상태 변경이 되지 않았습니다. 현재 상태: {actual_status_name}")
        
        # 4. 실제 상태가 변경되었을 때만 로컬 DB 업데이트
        db_result = db.set_update_issue_statusname(redmine_id, old_status_name, new_status_name)
        
        if not db_result.get("success"):
            raise HTTPException(status_code=400, detail=db_result.get("message", "DB 업데이트 실패"))
        
        return {
            "success": True,
            "message": f"이슈 #{redmine_id} 상태가 성공적으로 변경되었습니다: {old_status_name} → {new_status_name}",
            "data": {
                "redmine_id": redmine_id,
                "old_status": old_status_name,
                "new_status": new_status_name
            }
        }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이슈 상태 업데이트 실패: {str(e)}")

