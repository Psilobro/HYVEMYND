@echo off
echo ============================================
echo HYVEMYND UHP Engine Setup
echo ============================================
echo.

echo 1. Installing Node.js dependencies...
cd tools
if not exist node_modules (
    npm install
    if errorlevel 1 (
        echo Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed.
)

echo.
echo 2. Checking for engine files...

:: Check for nokamute
set NOKAMUTE_FOUND=0
if exist "nokamute.exe" (
    set NOKAMUTE_FOUND=1
    echo ✓ Found nokamute.exe
) else if exist "..\engines\nokamute.exe" (
    set NOKAMUTE_FOUND=1
    echo ✓ Found nokamute.exe in engines folder
) else if exist "..\reference-ai-5\target\release\nokamute.exe" (
    set NOKAMUTE_FOUND=1
    echo ✓ Found nokamute.exe in reference-ai-5
) else (
    echo ⚠  nokamute.exe not found
    echo   Place nokamute.exe in one of these locations:
    echo   - tools\nokamute.exe
    echo   - engines\nokamute.exe  
    echo   - reference-ai-5\target\release\nokamute.exe
)

:: Check for Mzinga
set MZINGA_FOUND=0
if exist "MzingaEngine.exe" (
    set MZINGA_FOUND=1
    echo ✓ Found MzingaEngine.exe
) else if exist "..\engines\MzingaEngine.exe" (
    set MZINGA_FOUND=1
    echo ✓ Found MzingaEngine.exe in engines folder
) else if exist "..\reference-ai-4\MzingaEngine.exe" (
    set MZINGA_FOUND=1
    echo ✓ Found MzingaEngine.exe in reference-ai-4
) else (
    echo ⚠  MzingaEngine.exe not found
)

echo.
if %NOKAMUTE_FOUND%==1 (
    echo ============================================
    echo Setup Complete! 🎉
    echo ============================================
    echo.
    echo To start the UHP bridge:
    echo   npm start
    echo.
    echo Or manually:
    echo   node uhp-bridge.js
    echo.
    echo Then open your game and click Dev. Ops → Engine tab
    echo ============================================
) else (
    echo ============================================
    echo Setup Incomplete ⚠
    echo ============================================
    echo.
    echo Please add nokamute.exe to continue.
    echo You can still run the bridge, but no engines will be available.
    echo ============================================
)

pause