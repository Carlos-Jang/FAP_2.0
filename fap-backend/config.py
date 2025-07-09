# config.py

# Redmine 서버 기본 설정
REDMINE_URL = "https://pms.ati2000.co.kr"  # 👉 여기에 실제 Redmine 서버 주소 입력
API_KEY = "1027e66e2aaf69c176b7e7227a3e2986c93c40ba"  # 👉 Redmine의 개인 API KEY 입력

# 기본 날짜 범위 (예: 최근 30일 데이터 조회)
DEFAULT_DATE_RANGE_DAYS = 30

# 기본 프로젝트 ID (선택사항)
DEFAULT_PROJECT_ID = 1

# 출력 시 사용할 기본 폰트 (tkinter에서 한글 깨짐 방지용)
DEFAULT_FONT = ("맑은 고딕", 10)

# Root 프로젝트(팀) ID: Help GPT 프로젝트
HELP_GPT_PROJECT_ID = "help-gpt"  # 'Help GPT' 프로젝트의 Redmine ID

# 팀별 관리 설비명 리스트 (프로젝트명 앞부분)
TEAM_PROJECTS = {
    "Measure": [
        "WIND 3D",
        "Camellia2",
        "OAK 3D",
        "Putter",
        "Triton",
    ],
}
