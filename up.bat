@echo off
title StockBase - fast start
echo Starting containers (no rebuild)...
docker compose up -d
if errorlevel 1 (
    echo.
    echo [ERROR] Failed. If containers do not exist yet, run start.bat first.
    pause
    exit /b 1
)
echo.
echo [OK] Site: http://localhost:3000
start "" http://localhost:3000
timeout /t 3 >nul
