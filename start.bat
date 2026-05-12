@echo off
title StockBase - start
cd /d "%~dp0"

REM Гарантируем, что окно НЕ закроется ни при какой ошибке -
REM в самом конце скрипта стоит pause, плюс мы оборачиваем cmd в /K.
REM Если скрипт упал на синтаксисе - смотри последнюю строку терминала.

setlocal enabledelayedexpansion

echo ============================================
echo   StockBase: starting in Docker
echo ============================================
echo Folder: %CD%
echo.

REM --- 1. Check Docker ---
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker not found. Install Docker Desktop:
    echo https://www.docker.com/products/docker-desktop/
    goto end
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
        goto end
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

REM --- 2.1 docker-compose.yml exists? ---
if not exist "docker-compose.yml" (
    echo [ERROR] docker-compose.yml not found in %CD%
    echo You are running start.bat from the WRONG folder.
    echo Open the StockBase project folder and double-click start.bat there.
    goto end
)

REM --- 2.2 Warn about busy ports, non-fatal ---
call :checkport 3000
call :checkport 8080
call :checkport 5432
call :checkport 8081

REM --- 2.3 docker-compose syntax check ---
docker compose config --quiet 2>nul
if errorlevel 1 (
    echo [ERROR] docker-compose.yml has syntax errors. Details:
    docker compose config
    goto end
)

REM --- 3. Build and start containers ---
echo.
echo [..] Building and starting containers ^(first run: 2-5 minutes^)
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
        echo   1^) No internet access from Docker ^(proxy/firewall^).
        echo   2^) Path with non-ASCII chars or spaces - run diagnose.bat.
        echo   3^) Antivirus blocks Docker. Add exception for Docker Desktop.
        echo   4^) WSL2 backend disabled. Enable in Docker Desktop settings.
        goto end
    )
    docker compose up -d
    if errorlevel 1 (
        echo [ERROR] Cannot start containers. Last logs:
        docker compose ps -a
        docker compose logs --tail=30
        goto end
    )
)

REM --- 4. Wait for backend ---
echo.
echo [..] Waiting for backend ^(up to 90 sec^)
set /a tries=0
:waitloop
set /a tries+=1
curl -s -o nul -w "%%{http_code}" http://localhost:8080/api/crud?action=check > "%TEMP%\sb_status.txt" 2>nul
set /p code=<"%TEMP%\sb_status.txt"
del "%TEMP%\sb_status.txt" >nul 2>&1
if "!code!"=="200" goto ready
if !tries! GEQ 45 (
    echo.
    echo [WARN] Backend did not respond in 90 sec. Logs:
    docker compose logs --tail=60 backend
    echo.
    echo DB logs:
    docker compose logs --tail=20 db
    echo.
    echo Run logs.bat to see full logs.
    goto end
)
timeout /t 2 /nobreak >nul
goto waitloop
:ready
echo [OK] Backend is responding

REM --- 5. Ensure admin user exists ---
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
echo   up.bat               - fast start ^(no rebuild^)
echo   stop.bat             - stop containers
echo   update.bat           - get latest version + rebuild
echo   logs.bat             - view logs
echo   reset-pass.bat       - reset admin password to admin123
echo   reset.bat            - full DB reset
echo   build-apk-button.bat - build APK for phone
echo.
start "" http://localhost:3000
goto end

REM ─── Subroutine: check if port is in LISTENING state ────────────────
:checkport
set "P=%~1"
netstat -ano -p tcp | findstr "LISTENING" | findstr ":%P% " >nul 2>&1
if not errorlevel 1 (
    echo [WARN] Port %P% is already in use. StockBase may fail to start.
    echo        Close the program holding port %P% or edit docker-compose.yml.
)
exit /b 0

:end
echo.
echo Press any key to close this window...
pause >nul
endlocal