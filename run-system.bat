@echo off
TITLE SMR Mirroring & Remote Control Platform - One-Click Launcher
COLOR 0A
CLS

echo =========================================================================
echo       SMR PHONE SCREEN MIRRORING & REMOTE CONTROL PLATFORM
echo =========================================================================
echo.
echo [1/3] Running System Verification Tests...
node tests/transform/coordinateTransform.test.cjs
if %errorlevel% neq 0 (
    echo [ERROR] Verification failed!
    pause
    exit /b %errorlevel%
)
echo.

echo [2/3] Starting Backend Signaling Server (Port 4000)...
start "SMR Signaling Server" cmd /k "cd /d %~dp0 && pnpm --filter @smr/server dev"
echo Backend Signaling Server launched in background window.
echo.

echo [3/3] Opening Minimal Web UI Automatically...
timeout /t 2 /nobreak >nul
start "" "%~dp0index.html"
echo.

echo =========================================================================
echo   SYSTEM FULLY OPERATIONAL & UI OPENED!
echo =========================================================================
echo.
echo  Signaling Gateway URL : ws://localhost:4000/ws/signaling
echo  REST API URL          : http://localhost:4000/api/v1/health
echo.
echo  Next Steps:
echo  1. Open /apps/android in Android Studio & run SMR app on your phone.
echo  2. Click 'Generate Pairing Code' on phone app.
echo  3. Enter code in the opened Web UI to mirror screen and remote control!
echo =========================================================================
echo.
