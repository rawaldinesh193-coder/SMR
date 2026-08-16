# Android Setup & Building Guide

## Requirements
- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 34 (Android 14)
- Physical Device or Emulator running Android 8.0+ (API 26+)

## Building the APK
```bash
cd apps/android
./gradlew assembleDebug
```

## Enable Remote Control Accessibility Permission
To allow remote touch injection from your laptop:
1. Open Android System Settings on your phone.
2. Navigate to **Accessibility** -> **Installed Apps**.
3. Select **SMR Remote Control Engine**.
4. Toggle switch to **ON** and confirm prompt.
