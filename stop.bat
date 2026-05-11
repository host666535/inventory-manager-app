@echo off
chcp 65001 >nul
title StockBase - остановка
echo Останавливаю контейнеры...
docker compose down
echo.
echo [OK] Остановлено. Данные сохранены в Docker-томе.
pause
