@echo off
chcp 65001 >nul
echo ========================================
echo Audio Switch Pro - Release
echo ========================================
echo.

cd /d "%~dp0"

if not exist "plugin" (
    echo ERROR: plugin folder not found.
    pause
    exit /b 1
)

echo [1/3] Checking files...

set MISSING=0

if not exist "plugin\main.js" (
    echo   ERROR: main.js not found!
    set /a MISSING+=1
)

if not exist "plugin\node_modules\ws" (
    echo   WARNING: ws not found, installing...
    cd plugin && call npm install ws --omit=dev && cd ..
)

if not exist "plugin\nircmd.exe" (
    echo   ERROR: nircmd.exe not found!
    set /a MISSING+=1
)

if %MISSING% gtr 0 (
    echo.
    echo ERROR: Required files missing! Run install.bat first.
    pause
    exit /b 1
)

echo   OK!

echo.
echo [2/3] Creating archive...

set ZIP_NAME=com.lizard.switchaudio.sdPlugin.zip
set RELEASE_DIR=release_temp
set PLUGIN_FOLDER=com.lizard.switchaudio.sdPlugin

:: Clean up old
if exist "%ZIP_NAME%" del /q "%ZIP_NAME%"
if exist "%RELEASE_DIR%" rmdir /s /q "%RELEASE_DIR%"

:: Create structure with plugin folder inside
mkdir "%RELEASE_DIR%\%PLUGIN_FOLDER%\plugin"
mkdir "%RELEASE_DIR%\%PLUGIN_FOLDER%\plugin\node_modules"
mkdir "%RELEASE_DIR%\%PLUGIN_FOLDER%\images"

:: Root files
copy /y manifest.json "%RELEASE_DIR%\%PLUGIN_FOLDER%\" >nul
copy /y property.html "%RELEASE_DIR%\%PLUGIN_FOLDER%\" >nul
copy /y property-mute.html "%RELEASE_DIR%\%PLUGIN_FOLDER%\" >nul
copy /y property-volume.html "%RELEASE_DIR%\%PLUGIN_FOLDER%\" >nul
copy /y property-ptt.html "%RELEASE_DIR%\%PLUGIN_FOLDER%\" >nul
copy /y property-play.html "%RELEASE_DIR%\%PLUGIN_FOLDER%\" >nul
copy /y en.json "%RELEASE_DIR%\%PLUGIN_FOLDER%\" >nul
copy /y ru.json "%RELEASE_DIR%\%PLUGIN_FOLDER%\" >nul
copy /y zh.json "%RELEASE_DIR%\%PLUGIN_FOLDER%\" >nul

:: Images
xcopy /s /q /y images\*.svg "%RELEASE_DIR%\%PLUGIN_FOLDER%\images\" >nul
xcopy /s /q /y images\*.png "%RELEASE_DIR%\%PLUGIN_FOLDER%\images\" >nul 2>nul

:: Plugin - only what's needed
copy /y plugin\main.js "%RELEASE_DIR%\%PLUGIN_FOLDER%\plugin\" >nul
copy /y plugin\package.json "%RELEASE_DIR%\%PLUGIN_FOLDER%\plugin\" >nul
copy /y plugin\nircmd.exe "%RELEASE_DIR%\%PLUGIN_FOLDER%\plugin\" >nul
if exist plugin\AudioSwitch.exe copy /y plugin\AudioSwitch.exe "%RELEASE_DIR%\%PLUGIN_FOLDER%\plugin\" >nul

:: Only ws module (no dev deps)
xcopy /s /q /y plugin\node_modules\ws "%RELEASE_DIR%\%PLUGIN_FOLDER%\plugin\node_modules\ws\" >nul

:: ZIP - archive the plugin folder, not its contents
powershell -Command "Compress-Archive -Path '%RELEASE_DIR%\%PLUGIN_FOLDER%' -DestinationPath '%ZIP_NAME%' -Force"

:: Cleanup
rmdir /s /q "%RELEASE_DIR%"

if not exist "%ZIP_NAME%" (
    echo   ERROR: Failed to create archive!
    pause
    exit /b 1
)

for %%A in ("%ZIP_NAME%") do set SIZE=%%~zA
set /a SIZE_KB=%SIZE%/1024

echo.
echo [3/3] Done!
echo.
echo ========================================
echo Created: %ZIP_NAME% (%SIZE_KB% KB)
echo.
echo Install: Extract to
echo %%APPDATA%%\HotSpot\StreamDock\plugins\
echo Then restart StreamDock
echo ========================================
pause
