# 1. 베이스 이미지 선택 (가벼운 Nginx 이미지)
FROM nginx:stable-alpine

# 2. 기존 기본 설정 파일 삭제
# 충돌을 방지하기 위해 Nginx의 기본 설정을 삭제합니다.
RUN rm /etc/nginx/conf.d/default.conf

# 3. 커스텀 설정 파일 복사
# 우리가 작성한 nginx.conf 파일을 컨테이너의 설정 디렉토리로 복사합니다.
# 이 설정 파일에 따라 Nginx가 동작하게 됩니다.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 4. 포트 노출
# Nginx의 기본 HTTP 포트인 80번을 개방합니다.
EXPOSE 80

# 5. Nginx 실행
# Nginx 데몬을 실행하여 요청을 받을 준비를 합니다.
CMD ["nginx", "-g", "daemon off;"]
