@echo off
chcp 65001 >nul
echo ========================================
echo Audio Switch Pro - Installation
echo ========================================
echo.

cd /d "%~dp0plugin"

echo [1/3] Installing npm packages...
call npm install ws
if %errorlevel% neq 0 (
    echo WARNING: npm install failed.
)

echo.
echo [2/3] Downloading nircmd (audio switcher utility)...

:: Download nircmd if not exists
if not exist "nircmd.exe" (
    echo Downloading from nirsoft.net...
    powershell -Command "Invoke-WebRequest -Uri 'https://www.nirsoft.net/utils/nircmd-x64.zip' -OutFile 'nircmd.zip'"
    if exist "nircmd.zip" (
        echo Extracting...
        powershell -Command "Expand-Archive -Path 'nircmd.zip' -DestinationPath '.' -Force"
        del nircmd.zip 2>nul
        echo nircmd.exe downloaded successfully!
    ) else (
        echo WARNING: Failed to download nircmd.
    )
) else (
    echo nircmd.exe already exists.
)

echo.
echo [3/3] Compiling AudioSwitch.exe (optional, for better device listing)...

set CSC=
if exist "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
) else if exist "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe" (
    set CSC=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe
)

if "%CSC%"=="" (
    echo csc.exe not found, skipping C# helper compilation.
    echo Plugin will use nircmd + PowerShell for device listing.
) else (
    echo Found compiler: %CSC%
    "%CSC%" /nologo /optimize /out:AudioSwitch.exe AudioSwitch.cs
    if %errorlevel% equ 0 (
        echo AudioSwitch.exe compiled successfully!
    ) else (
        echo C# compilation failed, will use nircmd instead.
    )
)

echo.
echo ========================================
echo Installation complete!
echo Please restart StreamDock to load the plugin.
echo ========================================
pause
