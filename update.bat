@echo off
setlocal enabledelayedexpansion
title StockBase - update from server
cd /d "%~dp0"

echo ============================================
echo   StockBase: update to latest version
echo ============================================
echo.

REM --- 1. Check Docker ---
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop is not running. Start it first.
    pause
    exit /b 1
)

REM --- 2. Check git and detect if project is a git repo ---
set "HAS_GIT=0"
set "IS_REPO=0"
git --version >nul 2>&1
if not errorlevel 1 set "HAS_GIT=1"
if "%HAS_GIT%"=="1" (
    git rev-parse --is-inside-work-tree >nul 2>&1
    if not errorlevel 1 set "IS_REPO=1"
)

if "%IS_REPO%"=="1" (
    echo [..] Saving any local changes...
    git stash push -u -m "auto-stash-before-update" >nul 2>&1

    echo [..] Downloading latest code via git...
    git pull --rebase
    if errorlevel 1 (
        echo.
        echo [ERROR] git pull failed. Try manual fix or use ZIP update below.
        git stash pop >nul 2>&1
        pause
        exit /b 1
    )
    echo [OK] Code updated via git
) else (
    REM --- ZIP update path: project was downloaded as ZIP, not cloned ---
    echo [INFO] This project is NOT a git repo - using ZIP update.
    if "%HAS_GIT%"=="0" (
        echo [INFO] Git is not installed - that's OK, will use ZIP.
    )
    echo.
    echo To update via ZIP:
    echo   1) Open project page in browser
    echo   2) Download fresh archive (ZIP)
    echo   3) Unpack OVER current folder (replace files)
    echo   4) Run update.bat again - it will rebuild containers
    echo.
    echo OR install Git to enable auto-update:
    echo   https://git-scm.com/download/win
    echo.
    set /p ANS=Continue with rebuild of CURRENT code? (y/n): 
    if /i not "!ANS!"=="y" (
        echo Canceled.
        pause
        exit /b 0
    )
)

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
if "!code!"=="200" goto ready
if !tries! GEQ 30 (
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