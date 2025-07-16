from db_manager import db_manager

def test_sync():
    print("=== 레드마인 일감 동기화 테스트 ===")
    
    # 1. 현재 DB 일감 개수 확인
    current_count = db_manager.get_issue_count()
    print(f"현재 DB 일감 개수: {current_count}")
    
    # 2. 동기화 실행
    print("\n동기화 시작...")
    result = db_manager.sync_recent_issues(10)  # 10개만 테스트
    
    # 3. 결과 출력
    print(f"\n동기화 결과:")
    print(f"성공: {result['success']}")
    print(f"메시지: {result['message']}")
    print(f"처리된 개수: {result['count']}")
    
    if result['success']:
        print(f"추가된 개수: {result.get('saved', 0)}")
        print(f"업데이트된 개수: {result.get('updated', 0)}")
    else:
        print(f"에러: {result.get('error', '알 수 없는 오류')}")
    
    # 4. 동기화 후 DB 일감 개수 확인
    new_count = db_manager.get_issue_count()
    print(f"\n동기화 후 DB 일감 개수: {new_count}")
    print(f"변화량: {new_count - current_count}")

if __name__ == "__main__":
    test_sync() 