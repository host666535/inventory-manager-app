@echo off
chcp 65001 >nul
title StockBase - логи
echo Логи всех сервисов (Ctrl+C - выйти):
echo.
docker compose logs -f --tail=50
