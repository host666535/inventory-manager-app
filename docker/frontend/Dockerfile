FROM node:20-alpine AS build

WORKDIR /app

# Системные зависимости для нативных модулей (например, sharp/canvas, если появятся)
RUN apk add --no-cache python3 make g++ libc6-compat || true

# Сначала только манифесты — кешируется слой с зависимостями
COPY package.json package-lock.json* bun.lockb* ./

# npm ci быстрее и детерминирован при наличии package-lock.json;
# fallback на npm install если lock-файла нет.
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund --legacy-peer-deps; \
    else \
      npm install --no-audit --no-fund --legacy-peer-deps; \
    fi

COPY . .

ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]