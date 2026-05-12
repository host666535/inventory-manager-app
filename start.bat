@echo off
setlocal enabledelayedexpansion
title StockBase - start
cd /d "%~dp0"

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
    echo [..] Docker Desktop is not running. Trying to start it...
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" 2>nul
    set /a wait_dk=0
    :waitdocker
    set /a wait_dk+=1
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if not errorlevel 1 goto dockerok
    if !wait_dk! GEQ 30 (
        echo [ERROR] Docker did not start in 90 seconds.
        echo Open Docker Desktop manually, wait for "Engine running", then run start.bat again.
        pause
        exit /b 1
    )
    goto waitdocker
    :dockerok
)
echo [OK] Docker is running

REM --- 2. .env with DB password ---
if not exist ".env" (
    echo DB_PASSWORD=stockbase_secret> .env
    echo [OK] Created .env
)

REM --- 2.0 Check ports are free ---
for %%P in (3000 8080 5432 8081) do (
    netstat -ano | findstr ":%%P " | findstr "LISTENING" >nul
    if not errorlevel 1 (
        echo [WARN] Port %%P is already in use. StockBase may fail to start.
        echo If start fails - close the program holding port %%P or change ports in docker-compose.yml.
    )
)

REM --- 2.1 docker-compose.yml exists? ---
if not exist "docker-compose.yml" (
    echo [ERROR] docker-compose.yml not found in %CD%
    echo You are running start.bat from the WRONG folder.
    echo Open StockBase project folder and double-click start.bat there.
    pause
    exit /b 1
)

REM --- 2.2 docker-compose syntax check ---
docker compose config --quiet 2>nul
if errorlevel 1 (
    echo [ERROR] docker-compose.yml has syntax errors. Details:
    docker compose config
    pause
    exit /b 1
)

REM --- 3. Build and start containers ---
echo.
echo [..] Building and starting containers (first run: 2-5 minutes)
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo [!] First attempt failed. Trying clean rebuild without cache...
    docker compose down 2>nul
    docker compose build --no-cache
    if errorlevel 1 (
        echo.
        echo [ERROR] Build failed. See output above.
        echo Common reasons:
        echo   1) No internet access from Docker (proxy/firewall).
        echo   2) Path with non-ASCII chars or spaces - run diagnose.bat.
        echo   3) Antivirus blocks Docker. Add exception for Docker Desktop.
        echo   4) WSL2 backend disabled. Enable in Docker Desktop settings.
        pause
        exit /b 1
    )
    docker compose up -d
    if errorlevel 1 (
        echo [ERROR] Cannot start containers. Last logs:
        docker compose ps -a
        docker compose logs --tail=30
        pause
        exit /b 1
    )
)

REM --- 4. Wait for backend ---
echo.
echo [..] Waiting for backend (up to 90 sec)
set /a tries=0
:waitloop
set /a tries+=1
curl -s -o nul -w "%%{http_code}" http://localhost:8080/api/crud?action=check > "%TEMP%\sb_status.txt" 2>nul
set /p code=<"%TEMP%\sb_status.txt"
del "%TEMP%\sb_status.txt" >nul 2>&1
if "!code!"=="200" goto ready
REM Each 10 tries (~20 sec) check if backend container is running at all
set /a mod=!tries! %% 10
if !mod!==0 (
    docker compose ps backend | find "Up" >nul
    if errorlevel 1 (
        echo.
        echo [ERROR] Backend container is not running. Logs:
        docker compose logs --tail=60 backend
        echo.
        echo DB logs:
        docker compose logs --tail=30 db
        pause
        exit /b 1
    )
)
if !tries! GEQ 45 (
    echo.
    echo [WARN] Backend did not respond in 90 sec. Logs:
    docker compose logs --tail=60 backend
    echo.
    echo Run logs.bat to see full logs.
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
goto waitloop
:ready
echo [OK] Backend is responding

REM --- 5. Ensure admin user exists (do NOT overwrite password if user changed it) ---
echo [..] Checking admin user
docker compose exec -T backend python -c "import os, psycopg2, bcrypt; c=psycopg2.connect(os.environ['DATABASE_URL']); cu=c.cursor(); cu.execute(\"SELECT 1 FROM public.users WHERE username='admin'\"); ex=cu.fetchone(); h=bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode(); cu.execute(\"INSERT INTO public.users (id, username, password_hash, display_name, role, is_active) VALUES ('user-admin-1','admin',%%s,'Admin','admin',TRUE) ON CONFLICT (username) DO UPDATE SET is_active=TRUE\", (h,)); c.commit(); print('[OK] admin exists' if ex else '[OK] admin created (login: admin / pass: admin123)')" 2>nul

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
echo   update.bat           - get latest version + rebuild
echo   logs.bat             - view logs
echo   reset-pass.bat       - reset admin password to admin123
echo   reset.bat            - full DB reset
echo   build-apk-button.bat - build APK for phone
echo.
start "" http://localhost:3000
pause