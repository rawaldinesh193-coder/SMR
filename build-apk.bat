@echo off
TITLE Build Android APK - SMR Phone Mirroring (Clean Build)
cd /d "%~dp0apps\android"

> local.properties echo sdk.dir=C\:\\Users\\MAYUR\\AppData\\Local\\Android\\Sdk

if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
)

if exist "C:\Users\MAYUR\Desktop\SMR-Mirror-PhoneApp.apk" (
    del /f /q "C:\Users\MAYUR\Desktop\SMR-Mirror-PhoneApp.apk"
)

call gradlew.bat clean assembleDebug --rerun-tasks
if %errorlevel% equ 0 (
    echo.
    echo Copying latest fresh APK to Desktop...
    copy "app\build\outputs\apk\debug\app-debug.apk" "C:\Users\MAYUR\Desktop\SMR-Mirror-PhoneApp.apk"
)
pause
