@echo off
title StockBase - logs
echo Logs of all services (Ctrl+C to exit):
echo.
docker compose logs -f --tail=50
