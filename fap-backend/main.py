"""
FAP 2.0 - FastAPI 메인 애플리케이션 (백엔드)

핵심 역할:
- FAP 2.0의 FastAPI 서버 진입점 및 메인 애플리케이션
- 모든 라우터 통합 및 CORS 설정 관리
- 사용자 인증 및 로그인 처리 (PMS 시스템 연동)
- 기본 API 엔드포인트 및 헬스체크 제공

주요 기능:
- 서버 초기화: FastAPI 앱 생성 및 미들웨어 설정
- 라우터 통합: redmine_service, issue_database, setting_database 라우터 통합
- CORS 설정: 프론트엔드와의 안전한 통신을 위한 CORS 미들웨어
- 사용자 인증: PMS 시스템과 연동된 로그인 API 제공
- 기본 엔드포인트: 루트 경로, 헬스체크, 로그인 처리

API 엔드포인트:
- GET /: 루트 경로 (서버 상태 확인)
- GET /api/health: 헬스체크 (서버 상태 점검)
- POST /api/login: 사용자 로그인 (PMS 시스템 인증)

인증 시스템:
- PMS 시스템과 연동된 통합 로그인
- Redmine REST API를 통한 사용자 인증
- 실시간 인증 검증 및 오류 처리

라우터 구성:
- /api/projects: 레드마인 서비스 API (redmine_service)
- /api/issues: 이슈 데이터베이스 API (issue_database)
- /api/settings: 설정 데이터베이스 API (setting_database)

보안 설정:
- CORS 미들웨어로 프론트엔드 통신 보안
- PMS 시스템과의 안전한 인증 연동
- 적절한 오류 처리 및 예외 관리
"""

# main.py
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from redmine_service import router as PMS_router
from routers.issue_database import router as AE_issues_router
from routers.setting_database import router as settings_router
from routers.main_database import router as main_router
from routers.ae_make_report_data import router as ae_make_report_router
from pydantic import BaseModel
import requests

app = FastAPI(title="FAP 2.0", version="0.1.0")

# CORS 설정 추가
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:3000",
        "https://125.6.44.31:8443"  # 배포 환경 도메인 추가
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(PMS_router)
app.include_router(AE_issues_router)
app.include_router(settings_router)
app.include_router(main_router)
app.include_router(ae_make_report_router)

class LoginRequest(BaseModel):
    id: str
    password: str

@app.get("/")
async def read_root():  # 수정 불가
    return {"message": "Hello FAP 2.0!"}

@app.get("/api/health")
async def health_check(): # 미사용 
    return {"status": "ok"}

@app.post("/api/login")
async def login(req: LoginRequest):  # 수정 불가
    # Redmine REST API endpoint (예시: /users/current.json)
    url = "https://pms.ati2000.co.kr/users/current.json"
    try:
        response = requests.get(url, auth=(req.id, req.password), timeout=5)
        if response.status_code == 200:
            # 인증 성공
            return {"success": True}
        else:
            # 인증 실패
            raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    except Exception as e:
        raise HTTPException(status_code=500, detail="PMS와 동일한 ID 비밀번호를 입력해주세요.")
