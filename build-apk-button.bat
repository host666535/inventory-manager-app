@echo off
title StockBase - build APK for phone

echo ============================================
echo   Build APK for Android
echo ============================================
echo.
echo Requirements:
echo   - Node.js (npm)
echo   - Android Studio + Android SDK
echo   - ANDROID_HOME env variable set
echo.
echo Build takes 3-10 minutes. Output: StockBase.apk in project root.
echo.
set /p ANSWER=Start build? (y/n): 
if /i not "%ANSWER%"=="y" (
    echo Canceled.
    pause
    exit /b 0
)

call build-apk.bat
