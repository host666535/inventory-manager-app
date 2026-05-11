@echo off
chcp 65001 >nul
title StockBase - быстрый старт
echo Поднимаю контейнеры (без пересборки)...
docker compose up -d
if errorlevel 1 (
    echo.
    echo [ОШИБКА] Не удалось. Если контейнеры не существуют, запусти start.bat
    pause
    exit /b 1
)
echo.
echo [OK] Сайт: http://localhost:3000
start "" http://localhost:3000
timeout /t 3 >nul
