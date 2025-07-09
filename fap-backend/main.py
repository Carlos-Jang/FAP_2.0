# main.py
from fastapi import FastAPI, Request, HTTPException
from routers.projects import router as projects_router
from pydantic import BaseModel
import requests

app = FastAPI(title="FAP 2.0", version="0.1.0")

app.include_router(projects_router)

class LoginRequest(BaseModel):
    id: str
    password: str

@app.get("/")
async def read_root():
    return {"message": "Hello FAP 2.0!"}

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/login")
async def login(req: LoginRequest):
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
        raise HTTPException(status_code=500, detail="Redmine 서버와 통신에 실패했습니다.")
