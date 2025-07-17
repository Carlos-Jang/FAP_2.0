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
HELP_GPT_PROJECT_ID = "help-gpt"

# 고객사(Level 1) 프로젝트 ID 목록
CUSTOMER_PROJECT_IDS = [
    422,  # PMS System 안내
    9,    # 00. ATI 본사
    100,  # 01. 삼성전자
    265,  # 02. 하이닉스
    432,  # 03. Micron
    716,  # 04. PGM
    713,  # 05. AIT
    712,  # 06. 심택
    728,  # 07. 달마전자
    729,  # 08. 동하
    730,  # 09. DMS
    731,  # 10. absolics
    791,  # 11. 대덕전자
    792,  # 12. 성진전자
    802,  # 13. AT&S
    793,  # 14. RSE
    803,  # 15. Eastern
    833,  # 16. DNP
    839,  # 17. 원익 QNC
    205,  # 18. TEKSCEND
    415,  # 19. SK 실트론
]

# 특정 프로젝트 ID들 (하드코딩 레벨 설정용)
ATI_PROJECT_IDS = {
    'ATI_HEADQUARTERS': 9,      # 00. ATI 본사 (Level 11)
    'ATI_SAMPLE_EVALUATION': 846,  # ATI 시료 평가 (Level 21)
}  # 'Help GPT' 프로젝트의 Redmine ID
