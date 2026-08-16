@echo off
TITLE Build Android APK - SMR Phone Mirroring
cd /d "%~dp0apps\android"

if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
)

call gradlew.bat assembleDebug
if %errorlevel% equ 0 (
    echo.
    echo Copying APK to Desktop...
    copy "app\build\outputs\apk\debug\app-debug.apk" "C:\Users\MAYUR\Desktop\SMR-Mirror-PhoneApp.apk"
)
pause
