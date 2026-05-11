@echo off
title StockBase - update from server
cd /d "%~dp0"

echo ============================================
echo   StockBase: update to latest version
echo ============================================
echo.

REM --- 1. Check git ---
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git not found. Install: https://git-scm.com/download/win
    pause
    exit /b 1
)

REM --- 2. Check Docker ---
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop is not running. Start it first.
    pause
    exit /b 1
)

REM --- 3. Backup local changes (just in case) ---
echo [..] Saving any local changes...
git stash push -u -m "auto-stash-before-update" >nul 2>&1

REM --- 4. Pull latest code ---
echo [..] Downloading latest code...
git pull --rebase
if errorlevel 1 (
    echo.
    echo [ERROR] Could not download updates.
    git stash pop >nul 2>&1
    pause
    exit /b 1
)
echo [OK] Code updated

REM --- 5. Rebuild and restart ---
echo.
echo [..] Rebuilding containers (2-5 minutes)...
docker compose up -d --build
if errorlevel 1 (
    echo [ERROR] Rebuild failed. See log above.
    pause
    exit /b 1
)

REM --- 6. Wait for backend ---
echo.
echo [..] Waiting for backend...
set /a tries=0
:waitloop
set /a tries+=1
curl -s -o nul -w "%%{http_code}" http://localhost:8080/api/crud?action=check > "%TEMP%\sb_upd.txt" 2>nul
set /p code=<"%TEMP%\sb_upd.txt"
del "%TEMP%\sb_upd.txt" >nul 2>&1
if "%code%"=="200" goto ready
if %tries% GEQ 30 (
    echo [WARN] Backend slow. Check logs.bat
    goto done
)
timeout /t 2 /nobreak >nul
goto waitloop
:ready
echo [OK] Backend is responding

:done
echo.
echo ============================================
echo   UPDATED!  Open: http://localhost:3000
echo ============================================
start "" http://localhost:3000
pause
