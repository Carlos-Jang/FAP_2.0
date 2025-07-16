#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
프로젝트 DB 기능 테스트 스크립트
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db_manager import DatabaseManager

def test_projects():
    """프로젝트 관련 기능 테스트"""
    print("=== 프로젝트 DB 기능 테스트 시작 ===\n")
    
    db = DatabaseManager()
    
    # 1. 현재 프로젝트 개수 확인
    print("1. 현재 프로젝트 개수 확인...")
    count = db.get_project_count()
    print(f"   현재 프로젝트 개수: {count}개\n")
    
    # 2. Redmine에서 프로젝트 동기화
    print("2. Redmine에서 프로젝트 동기화...")
    result = db.sync_projects(limit=100)
    
    if result['success']:
        print(f"   ✅ 성공: {result['message']}")
        print(f"   총 {result['count']}개 프로젝트 처리")
        print(f"   새로 추가: {result['saved']}개")
        print(f"   업데이트: {result['updated']}개\n")
    else:
        print(f"   ❌ 실패: {result['error']}\n")
        return
    
    # 3. 동기화 후 프로젝트 개수 확인
    print("3. 동기화 후 프로젝트 개수 확인...")
    count = db.get_project_count()
    print(f"   동기화 후 프로젝트 개수: {count}개\n")
    
    # 4. 프로젝트 목록 조회 (처음 10개)
    print("4. 프로젝트 목록 조회 (처음 10개)...")
    projects = db.get_all_projects(limit=10)
    
    if projects:
        print("   프로젝트 목록:")
        for i, project in enumerate(projects, 1):
            print(f"   {i}. ID: {project['redmine_project_id']}, 이름: {project['project_name']}")
    else:
        print("   프로젝트가 없습니다.")
    print()
    
    # 5. 특정 프로젝트 조회 (첫 번째 프로젝트로 테스트)
    if projects:
        print("5. 특정 프로젝트 조회 테스트...")
        first_project_id = projects[0]['redmine_project_id']
        project = db.get_project_by_id(first_project_id)
        
        if project:
            print(f"   ✅ 프로젝트 조회 성공:")
            print(f"   ID: {project['redmine_project_id']}")
            print(f"   이름: {project['project_name']}")
            print(f"   생성일: {project['created_at']}")
        else:
            print(f"   ❌ 프로젝트 조회 실패")
        print()
    
    print("=== 프로젝트 DB 기능 테스트 완료 ===")

if __name__ == "__main__":
    test_projects() 