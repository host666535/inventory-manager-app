@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title StockBase - запуск

echo ============================================
echo   StockBase: запуск в Docker
echo ============================================
echo.

REM --- 1. Проверка Docker ---
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Docker не найден. Установи Docker Desktop:
    echo https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Docker запущен, но не отвечает.
    echo Открой Docker Desktop и подожди пока он стартует, потом повтори.
    pause
    exit /b 1
)
echo [OK] Docker работает

REM --- 2. .env с паролем БД ---
if not exist ".env" (
    echo DB_PASSWORD=stockbase_secret> .env
    echo [OK] Создан .env с паролем БД
)

REM --- 3. Сборка и запуск контейнеров ---
echo.
echo [..] Поднимаю контейнеры (билд может занять 2-5 минут при первом запуске)
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo [ОШИБКА] Не удалось запустить контейнеры.
    echo Посмотри лог выше. Часто помогает:
    echo   docker compose down -v
    echo   start.bat
    pause
    exit /b 1
)

REM --- 4. Ждём пока бэкенд ответит ---
echo.
echo [..] Жду готовности бэкенда (до 60 сек)
set /a tries=0
:waitloop
set /a tries+=1
curl -s -o nul -w "%%{http_code}" http://localhost:8080/api/crud?action=check > "%TEMP%\sb_status.txt" 2>nul
set /p code=<"%TEMP%\sb_status.txt"
del "%TEMP%\sb_status.txt" >nul 2>&1
if "%code%"=="200" goto ready
if %tries% GEQ 30 (
    echo.
    echo [ВНИМАНИЕ] Бэкенд не ответил за 60 сек. Логи:
    docker compose logs --tail=40 backend
    echo.
    echo Попробуй ^"docker compose logs -f backend^" чтобы посмотреть подробнее.
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
goto waitloop
:ready
echo [OK] Бэкенд отвечает

REM --- 5. Гарантируем что admin существует. Пароль НЕ трогаем если уже есть. ---
echo [..] Проверяю учётку admin
docker compose exec -T backend python -c "import os, psycopg2, bcrypt; c=psycopg2.connect(os.environ['DATABASE_URL']); cu=c.cursor(); cu.execute(\"SELECT 1 FROM public.users WHERE username='admin'\"); ex=cu.fetchone(); h=bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode(); cu.execute(\"INSERT INTO public.users (id, username, password_hash, display_name, role, is_active) VALUES ('user-admin-1','admin',%s,'Администратор','admin',TRUE) ON CONFLICT (username) DO UPDATE SET is_active=TRUE\", (h,)); c.commit(); print('[OK] admin exists' if ex else '[OK] admin created (login: admin, pass: admin123)')" 2>nul

REM --- 6. Открываем сайт ---
echo.
echo ============================================
echo   ГОТОВО!  Сайт: http://localhost:3000
echo ============================================
echo   Если входишь впервые: admin / admin123
echo   Если менял пароль - используй свой.
echo ============================================
echo.
echo Кнопки:
echo   up.bat          - быстрый старт (без пересборки)
echo   stop.bat        - остановить
echo   logs.bat        - смотреть логи
echo   reset-pass.bat  - сбросить пароль admin на admin123
echo   reset.bat       - полный сброс БД
echo.
start "" http://localhost:3000
pause