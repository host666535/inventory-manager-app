@echo off
chcp 65001 >nul
title StockBase - сброс пароля
echo.
echo Сброс пароля админа на admin123
echo.
set /p ANSWER=Точно сбросить? (y/n): 
if /i not "%ANSWER%"=="y" (
    echo Отменено.
    pause
    exit /b 0
)
docker compose exec -T backend python -c "import os, psycopg2, bcrypt; c=psycopg2.connect(os.environ['DATABASE_URL']); cu=c.cursor(); h=bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode(); cu.execute(\"UPDATE public.users SET password_hash=%%s, is_active=TRUE WHERE username='admin'\", (h,)); c.commit(); print('[OK] Пароль admin сброшен на admin123')"
echo.
pause
