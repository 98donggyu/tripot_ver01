# 1. 베이스 이미지 선택 (파이썬 3.12 슬림 버전)
FROM python:3.12-slim

# 2. 작업 디렉토리 설정
WORKDIR /backend

# 3. 파이썬 패키지 설치
# 먼저 requirements.txt 파일만 복사하여 패키지를 설치합니다.
# 이렇게 하면 소스 코드가 변경될 때마다 패키지를 새로 설치하는 비효율을 막을 수 있습니다.
COPY ./requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. 소스 코드 복사
# backend 폴더 내부의 모든 파일/폴더를 컨테이너의 작업 디렉토리로 복사합니다.
COPY . .

# 5. 포트 노출
# 컨테이너의 8000번 포트를 외부에 개방합니다.
EXPOSE 8000

# 6. 애플리케이션 실행
# uvicorn을 사용하여 main.py의 app 객체를 실행합니다.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]