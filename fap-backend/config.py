"""
FAP 2.0 - 시스템 설정 파일 (백엔드)

역할:
- FAP 2.0 시스템의 하드코딩된 기본 설정값들을 관리
- 레드마인 서버 연결 정보 및 API 키
- 프로젝트 ID 매핑 (20개 고객사 + ATI 내부)
- 기본 날짜 범위, 폰트, 기타 시스템 설정값

주요 설정:
- REDMINE_URL: 레드마인 서버 주소
- API_KEY: 기본 레드마인 API 키
- CUSTOMER_PROJECT_IDS: 20개 고객사 프로젝트 ID 목록
- ATI_PROJECT_IDS: ATI 내부 프로젝트 ID 매핑
- DEFAULT_DATE_RANGE_DAYS: 기본 날짜 범위 (30일)
- DEFAULT_FONT: 기본 폰트 설정
"""

# config.py

# Redmine 서버 기본 설정
REDMINE_URL = "https://pms.ati2000.co.kr"  # 👉 여기에 실제 Redmine 서버 주소 입력
API_KEY = "a5d5e798c5f9cbffaf407b9ab22b91306b83c8f9"  # 👉 Redmine의 개인 API KEY 입력

# 기본 날짜 범위 (예: 최근 30일 데이터 조회)
DEFAULT_DATE_RANGE_DAYS = 30

# 기본 프로젝트 ID (선택사항)
DEFAULT_PROJECT_ID = 1

# 출력 시 사용할 기본 폰트 (tkinter에서 한글 깨짐 방지용)
DEFAULT_FONT = ("맑은 고딕", 10)

# Root 프로젝트(팀) ID: Help GPT 프로젝트
HELP_GPT_PROJECT_ID = "help-gpt"

# 고객사(Level 1) 프로젝트 ID 목록
CUSTOMER_PROJECT_IDS = [
    100,  # 01. 삼성전자
    265,  # 02. 하이닉스
    432,  # 03. Micron
    876,  # 04. PKG
    205,  # 05. TEKSCEND
    415,  # 06. SK 실트론
    203,  # 07. Photronics
    839,  # 08. 원익 QNC
    833,  # 09. DNP
]

# 특정 프로젝트 ID들 (하드코딩 레벨 설정용)
ATI_PROJECT_IDS = {
    'ATI_HEADQUARTERS': 9,      # 00. ATI 본사 (Level 11)
    'ATI_SAMPLE_EVALUATION': 846,  # ATI 시료 평가 (Level 21)
    'ATI_GUIDE': 422,           # PMS System 안내 (Level 31)
}  # 'Help GPT' 프로젝트의 Redmine ID
