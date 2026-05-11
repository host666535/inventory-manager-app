@echo off
setlocal enabledelayedexpansion
title StockBase - start

echo ============================================
echo   StockBase: starting in Docker
echo ============================================
echo.

REM --- 1. Check Docker ---
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker not found. Install Docker Desktop:
    echo https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop is not running.
    echo Open Docker Desktop, wait for "Engine running", then run start.bat again.
    pause
    exit /b 1
)
echo [OK] Docker is running

REM --- 2. .env with DB password ---
if not exist ".env" (
    echo DB_PASSWORD=stockbase_secret> .env
    echo [OK] Created .env
)

REM --- 3. Build and start containers ---
echo.
echo [..] Building and starting containers (first run: 2-5 minutes)
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start containers. See log above.
    echo Try: docker compose down -v   then start.bat again
    pause
    exit /b 1
)

REM --- 4. Wait for backend ---
echo.
echo [..] Waiting for backend (up to 60 sec)
set /a tries=0
:waitloop
set /a tries+=1
curl -s -o nul -w "%%{http_code}" http://localhost:8080/api/crud?action=check > "%TEMP%\sb_status.txt" 2>nul
set /p code=<"%TEMP%\sb_status.txt"
del "%TEMP%\sb_status.txt" >nul 2>&1
if "%code%"=="200" goto ready
if %tries% GEQ 30 (
    echo.
    echo [WARN] Backend did not respond in 60 sec. Logs:
    docker compose logs --tail=40 backend
    echo.
    echo Use logs.bat to see full logs.
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
goto waitloop
:ready
echo [OK] Backend is responding

REM --- 5. Ensure admin user exists (do NOT overwrite password if user changed it) ---
echo [..] Checking admin user
docker compose exec -T backend python -c "import os, psycopg2, bcrypt; c=psycopg2.connect(os.environ['DATABASE_URL']); cu=c.cursor(); cu.execute(\"SELECT 1 FROM public.users WHERE username='admin'\"); ex=cu.fetchone(); h=bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode(); cu.execute(\"INSERT INTO public.users (id, username, password_hash, display_name, role, is_active) VALUES ('user-admin-1','admin',%s,'Admin','admin',TRUE) ON CONFLICT (username) DO UPDATE SET is_active=TRUE\", (h,)); c.commit(); print('[OK] admin exists' if ex else '[OK] admin created (login: admin / pass: admin123)')" 2>nul

echo.
echo ============================================
echo   DONE!  Open: http://localhost:3000
echo ============================================
echo   First login:  admin / admin123
echo   If you changed password - use your own.
echo ============================================
echo.
echo Buttons:
echo   up.bat               - fast start (no rebuild)
echo   stop.bat             - stop containers
echo   logs.bat             - view logs
echo   reset-pass.bat       - reset admin password to admin123
echo   reset.bat            - full DB reset
echo   build-apk-button.bat - build APK for phone
echo.
start "" http://localhost:3000
pause
