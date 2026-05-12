@echo off
title StockBase - diagnose
cd /d "%~dp0"

echo ============================================
echo   StockBase DIAGNOSE
echo ============================================
echo.
echo Current folder: %CD%
echo.

echo --- Step 0: Path sanity ---
echo %CD%| findstr /R /C:"[^a-zA-Z0-9_\\:.\- ]" >nul
if not errorlevel 1 (
    echo [WARN] Path contains non-ASCII chars or special symbols.
    echo Docker volumes may break. Move project to e.g. C:\stockbase
)
echo %CD% | find "Program Files" >nul
if not errorlevel 1 (
    echo [WARN] Project is under "Program Files". Move to C:\stockbase or similar.
)
echo.

echo --- Step 1: Docker version ---
docker --version
echo.

echo --- Step 2: Docker compose version ---
docker compose version
echo.

echo --- Step 3: Docker engine ping ---
docker info --format "Engine: {{.ServerVersion}}  OS: {{.OperatingSystem}}"
echo.

echo --- Step 4: docker-compose.yml exists? ---
if exist "docker-compose.yml" (echo YES) else (echo NO - WRONG FOLDER!)
echo.

echo --- Step 5: .env exists? ---
if exist ".env" (
    echo YES
    type .env
) else (
    echo NO - creating
    echo DB_PASSWORD=stockbase_secret> .env
)
echo.

echo --- Step 6: docker compose config check ---
docker compose config --quiet
if errorlevel 1 (
    echo [FAIL] docker-compose.yml has errors
) else (
    echo [OK] docker-compose.yml is valid
)
echo.

echo --- Step 7: Pull base images ---
docker compose pull
echo.

echo --- Step 8: Build and start ---
docker compose up -d --build
echo.

echo --- Step 9: List containers ---
docker compose ps -a
echo.

echo --- Step 10: Backend logs (last 30 lines) ---
docker compose logs --tail=30 backend
echo.

echo --- Step 11: DB logs (last 20 lines) ---
docker compose logs --tail=20 db
echo.

echo --- Step 12: Frontend logs (last 20 lines) ---
docker compose logs --tail=20 frontend
echo.

echo ============================================
echo   DIAGNOSE FINISHED
echo ============================================
echo Copy the entire output above and send it to support.
echo.
pause