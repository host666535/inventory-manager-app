@echo off
title StockBase - stop
echo Stopping containers...
docker compose down
echo.
echo [OK] Stopped. DB data is kept in Docker volume.
pause
