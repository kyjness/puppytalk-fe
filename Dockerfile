# -----------------------------------------------------------------------------
# Stage 1: Builder (Node.js 환경에서 의존성 설치 및 빌드)
# -----------------------------------------------------------------------------
# 버전은 .nvmrc·package.json engines와 함께 움직인다 — jsdom(테스트 환경)이 Node 24를 요구한다.
FROM node:24-alpine AS builder

WORKDIR /app

# 패키지 매니저는 pnpm이다(pnpm-lock.yaml). packageManager 필드가 버전을 고정한다.
RUN corepack enable

# 락파일 먼저 복사해 의존성 레이어를 캐시한다.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 소스 코드 전체 복사
COPY . .

# 빌드 시점에 주입받을 환경변수 (백엔드 API 주소)
# docker build --build-arg VITE_API_BASE_URL=https://api.example.com
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# 프로덕션 빌드 (dist 폴더 생성)
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 2: Runtime (Nginx 환경에서 정적 파일 서빙)
# -----------------------------------------------------------------------------
FROM nginx:alpine AS runtime

# Nginx의 기본 HTML 폴더 비우기
RUN rm -rf /usr/share/nginx/html/*

# Stage 1에서 빌드된 결과물(dist)을 Nginx 서빙 폴더로 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA 라우팅을 위한 Nginx 설정 덮어쓰기
# (사용자가 /login 같은 경로로 새로고침했을 때 404가 뜨는 것을 방지하고 index.html을 바라보게 함)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
