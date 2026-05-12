@echo off
title StockBase
cd /d "%~dp0"

echo ============================================
echo   StockBase: starting in Docker
echo ============================================
echo Folder: %CD%
echo.

REM Check Docker installed
docker --version >nul 2>&1
if errorlevel 1 goto no_docker

REM Check Docker engine running
docker info >nul 2>&1
if errorlevel 1 goto start_docker
goto docker_ok

:no_docker
echo [ERROR] Docker not found. Install Docker Desktop:
echo https://www.docker.com/products/docker-desktop/
goto end

:start_docker
echo [..] Docker Desktop is not running. Trying to start it...
start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" 2>nul
set wait_dk=0
:waitdocker
set /a wait_dk=%wait_dk%+1
timeout /t 3 /nobreak >nul
docker info >nul 2>&1
if not errorlevel 1 goto docker_ok
if %wait_dk% GEQ 30 goto docker_timeout
goto waitdocker

:docker_timeout
echo [ERROR] Docker did not start in 90 seconds.
echo Open Docker Desktop manually, wait for "Engine running", then run start.bat again.
goto end

:docker_ok
echo [OK] Docker is running

REM Create .env if missing
if not exist ".env" (
    echo DB_PASSWORD=stockbase_secret> .env
    echo [OK] Created .env
)

REM Check docker-compose.yml exists
if not exist "docker-compose.yml" goto no_compose

echo.
echo [..] Building and starting containers. First run takes 2-5 minutes.
docker compose up -d --build
if errorlevel 1 goto build_failed

echo.
echo [..] Waiting for backend up to 90 seconds...
set tries=0
:waitloop
set /a tries=%tries%+1
curl -s -o nul -w "%%{http_code}" http://localhost:8080/api/crud?action=check > "%TEMP%\sb_status.txt" 2>nul
set /p code=<"%TEMP%\sb_status.txt"
del "%TEMP%\sb_status.txt" >nul 2>&1
if "%code%"=="200" goto ready
if %tries% GEQ 45 goto backend_slow
timeout /t 2 /nobreak >nul
goto waitloop

:backend_slow
echo.
echo [WARN] Backend did not respond in 90 sec. Backend logs:
docker compose logs --tail=60 backend
echo.
echo DB logs:
docker compose logs --tail=20 db
goto end

:ready
echo [OK] Backend is responding

echo [..] Checking admin user
docker compose exec -T backend python -c "import os,psycopg2,bcrypt; c=psycopg2.connect(os.environ['DATABASE_URL']); cu=c.cursor(); cu.execute(\"SELECT 1 FROM public.users WHERE username='admin'\"); ex=cu.fetchone(); h=bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode(); cu.execute(\"INSERT INTO public.users (id, username, password_hash, display_name, role, is_active) VALUES ('user-admin-1','admin',%%s,'Admin','admin',TRUE) ON CONFLICT (username) DO UPDATE SET is_active=TRUE\", (h,)); c.commit(); print('admin exists' if ex else 'admin created: admin / admin123')" 2>nul

echo.
echo ============================================
echo   DONE. Open in browser: http://localhost:3000
echo ============================================
echo   Login: admin
echo   Password: admin123
echo ============================================
start "" http://localhost:3000
goto end

:no_compose
echo [ERROR] docker-compose.yml not found in %CD%
echo You are running start.bat from the WRONG folder.
goto end

:build_failed
echo.
echo [ERROR] Build failed. Read the output above.
echo Common reasons:
echo   - No internet from Docker
echo   - WSL2 disabled in Docker Desktop settings
echo   - Antivirus blocks Docker
echo   - Path with non-ASCII chars
goto end

:end
echo.
echo Press any key to close this window...
pause >nul
