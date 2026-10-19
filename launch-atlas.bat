@echo off
setlocal
title ATLAS Research Terminal Launcher

set "SCRIPT_DIR=%~dp0"
set "POWERSHELL_LAUNCHER=%SCRIPT_DIR%launch-atlas.ps1"

if not exist "%POWERSHELL_LAUNCHER%" (
    echo ERROR: launch-atlas.ps1 was not found beside this launcher.
    pause
    exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%POWERSHELL_LAUNCHER%"
set "LAUNCH_EXIT=%ERRORLEVEL%"

if not "%LAUNCH_EXIT%"=="0" (
    echo.
    echo ATLAS did not start. Review the error above.
    pause
)

exit /b %LAUNCH_EXIT%
