@echo off
title StockBase - update from server
cd /d "%~dp0"
setlocal enabledelayedexpansion

echo ============================================
echo   StockBase: update to latest version
echo ============================================
echo Folder: %CD%
echo.

REM --- 1. Check Docker ---
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop is not running. Start it first.
    goto end
)

REM --- 2. Detect git ---
set "HAS_GIT=0"
git --version >nul 2>&1
if not errorlevel 1 set "HAS_GIT=1"

set "IS_REPO=0"
if "!HAS_GIT!"=="1" (
    git rev-parse --is-inside-work-tree >nul 2>&1
    if not errorlevel 1 set "IS_REPO=1"
)

if "!IS_REPO!"=="1" goto git_update
goto zip_update

:git_update
echo [..] Saving any local changes...
git stash push -u -m "auto-stash-before-update" >nul 2>&1
echo [..] Downloading latest code via git...
git pull --rebase
if errorlevel 1 (
    echo.
    echo [ERROR] git pull failed.
    git stash pop >nul 2>&1
    goto end
)
echo [OK] Code updated via git
goto rebuild

:zip_update
echo [INFO] This project is NOT a git repo.
if "!HAS_GIT!"=="0" echo [INFO] Git is not installed - that's OK.
echo.
echo To update sources via ZIP:
echo   1^) Download fresh ZIP from project page
echo   2^) Unpack OVER this folder ^(replace files^)
echo   3^) Run update.bat again
echo.
echo OR install Git: https://git-scm.com/download/win
echo.
set /p ANS=Rebuild containers using CURRENT code? (y/n): 
if /i not "!ANS!"=="y" (
    echo Canceled.
    goto end
)

:rebuild
echo.
echo [..] Rebuilding containers (2-5 minutes)...
docker compose up -d --build
if errorlevel 1 (
    echo [ERROR] Rebuild failed. See log above.
    goto end
)

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

:end
echo.
echo Press any key to close this window...
pause >nul
endlocal
