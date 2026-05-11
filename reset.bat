@echo off
chcp 65001 >nul
title StockBase - полный сброс
echo.
echo ВНИМАНИЕ! Это удалит ВСЕ данные в локальной БД StockBase.
echo Бэкапы в папке ./backups останутся.
echo.
set /p ANSWER=Продолжить? (y/n): 
if /i not "%ANSWER%"=="y" (
    echo Отменено.
    pause
    exit /b 0
)
echo.
docker compose down -v
echo.
echo [OK] База удалена. Запускаю заново...
call start.bat
