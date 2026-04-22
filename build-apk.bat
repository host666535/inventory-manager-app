@echo off
REM ============================================================
REM  StockBase — Сборка APK (Windows)
REM ============================================================
REM  Что делает скрипт:
REM   1. Ставит зависимости (если нужно)
REM   2. Собирает веб-билд (Vite)
REM   3. Синхронизирует с Capacitor (копирует dist в android/)
REM   4. Собирает APK через Gradle
REM   5. Копирует готовый APK в корень проекта как StockBase.apk
REM
REM  Благодаря экрану настройки сервера из приложения
REM  АДРЕС СЕРВЕРА ПРИ СБОРКЕ УКАЗЫВАТЬ НЕ НУЖНО —
REM  пользователь введёт/отсканирует его при первом запуске.
REM ============================================================

setlocal
cd /d "%~dp0"

echo.
echo === [1/4] Проверка зависимостей...
if not exist "node_modules" (
    echo node_modules не найдена, запускаю npm install...
    call npm install
    if errorlevel 1 goto :error
)

echo.
echo === [2/4] Сборка веб-приложения (Vite)...
call npm run build
if errorlevel 1 goto :error

echo.
echo === [3/4] Синхронизация с Capacitor (Android)...
call npx cap sync android
if errorlevel 1 goto :error

echo.
echo === [4/4] Сборка APK (Gradle)...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
    cd ..
    goto :error
)
cd ..

set "APK_SRC=android\app\build\outputs\apk\debug\app-debug.apk"
set "APK_DST=StockBase.apk"

if not exist "%APK_SRC%" (
    echo.
    echo [ОШИБКА] APK не найден в %APK_SRC%
    goto :error
)

copy /Y "%APK_SRC%" "%APK_DST%" >nul

echo.
echo ============================================================
echo  ГОТОВО!
echo  APK: %CD%\%APK_DST%
echo ============================================================
echo.
echo  Теперь перенеси этот файл на телефон и установи.
echo  При первом запуске введи адрес сервера или отсканируй QR
echo  из раздела Настройки → Адрес сервера на компьютере.
echo.
pause
exit /b 0

:error
echo.
echo ============================================================
echo  ОШИБКА СБОРКИ. Проверь вывод выше.
echo ============================================================
pause
exit /b 1
