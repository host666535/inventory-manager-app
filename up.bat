@echo off
setlocal enabledelayedexpansion
title StockBase - fast start
cd /d "%~dp0"

docker info >nul 2>&1
if errorlevel 1 (
    echo Docker is not running. Starting Docker Desktop...
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" 2>nul
    set /a wait_dk=0
    :wait
    set /a wait_dk+=1
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if not errorlevel 1 goto ok
    if !wait_dk! GEQ 30 (
        echo [ERROR] Docker did not start.
        pause
        exit /b 1
    )
    goto wait
    :ok
)

echo Starting containers (no rebuild)...
docker compose up -d
if errorlevel 1 (
    echo.
    echo [ERROR] Failed. If containers do not exist yet, run start.bat first.
    pause
    exit /b 1
)

echo.
echo [..] Waiting for backend...
set /a t=0
:w
set /a t+=1
curl -s -o nul -w "%%{http_code}" http://localhost:8080/api/crud?action=check > "%TEMP%\sb_up.txt" 2>nul
set /p c=<"%TEMP%\sb_up.txt"
del "%TEMP%\sb_up.txt" >nul 2>&1
if "!c!"=="200" goto ready
if !t! GEQ 30 goto ready
timeout /t 2 /nobreak >nul
goto w
:ready

echo [OK] Site: http://localhost:3000
start "" http://localhost:3000
timeout /t 3 >nul
