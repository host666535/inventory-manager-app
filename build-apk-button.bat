@echo off
chcp 65001 >nul
title StockBase - сборка APK для телефона

echo ============================================
echo   Сборка APK для Android
echo ============================================
echo.
echo Что нужно для сборки:
echo   - Node.js (npm)
echo   - Android Studio + Android SDK
echo   - Переменная ANDROID_HOME настроена
echo.
echo Сборка займёт 3-10 минут. Готовый файл появится
echo в корне проекта как StockBase.apk
echo.
set /p ANSWER=Начать сборку? (y/n): 
if /i not "%ANSWER%"=="y" (
    echo Отменено.
    pause
    exit /b 0
)

call build-apk.bat
