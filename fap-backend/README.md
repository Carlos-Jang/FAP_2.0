# FAP 2.0 Backend

FAP (FAP Analysis Platform) 2.0 백엔드 서버

## 기능

- **레드마인 API 연동**: 레드마인에서 일감 데이터를 가져와 로컬 DB에 저장
- **일감 관리**: 일감 조회, 검색, 통계 기능
- **RESTful API**: 프론트엔드와 연동하기 위한 API 엔드포인트 제공

## 기술 스택

- **FastAPI**: Python 웹 프레임워크
- **PyMySQL**: MariaDB 연결
- **MariaDB**: 로컬 데이터베이스
- **Redmine API**: 외부 일감 데이터 소스

## 설치 및 실행

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 데이터베이스 설정
- XAMPP MariaDB 설치 및 실행
- `fap_redmine` 데이터베이스 생성
- `issues` 테이블 생성

### 3. 환경 설정
`config.py` 파일에서 레드마인 API 키 설정:
```python
REDMINE_URL = "https://pms.ati2000.co.kr"
API_KEY = "your_api_key_here"
```

### 4. 서버 실행
```bash
python main.py
```

## API 엔드포인트

### 일감 관련
- `GET /api/issues/` - 일감 목록 조회
- `GET /api/issues/{issue_id}` - 특정 일감 조회
- `POST /api/issues/sync` - 레드마인에서 일감 동기화
- `GET /api/issues/stats/summary` - 일감 통계 요약

### 인증
- `POST /api/login` - 레드마인 로그인

## 데이터베이스 스키마

### issues 테이블
```sql
CREATE TABLE issues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    redmine_id INT NOT NULL UNIQUE,
    raw_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### projects 테이블
```sql
CREATE TABLE projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    redmine_project_id INT NOT NULL UNIQUE,
    project_name VARCHAR(255) NOT NULL,
    raw_data JSON,
    children_ids JSON,  -- 하위 프로젝트 ID 배열
    level INT DEFAULT 0, -- 프로젝트 계층 레벨 (0: 최상위, 1: 하위)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 개발 가이드

### 새로운 API 추가
1. `routers/` 폴더에 새 라우터 파일 생성
2. `main.py`에 라우터 등록
3. API 문서는 자동으로 `/docs`에서 확인 가능

### 데이터베이스 작업
- `db_manager.py`의 `DatabaseManager` 클래스 사용
- PyMySQL을 사용하여 MariaDB 연결 