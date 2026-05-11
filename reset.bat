@echo off
title StockBase - full reset
echo.
echo WARNING! This will DELETE all data in the local StockBase DB.
echo Files in ./backups will remain.
echo.
set /p ANSWER=Continue? (y/n): 
if /i not "%ANSWER%"=="y" (
    echo Canceled.
    pause
    exit /b 0
)
echo.
docker compose down -v
echo.
echo [OK] DB deleted. Starting fresh...
call start.bat
