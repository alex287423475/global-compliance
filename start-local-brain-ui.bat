@echo off
setlocal
cd /d "%~dp0"
call powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-local-brain-env.ps1"
if not "%ERRORLEVEL%"=="0" pause & exit /b %ERRORLEVEL%
start "Local Brain Next Workbench" powershell -NoProfile -ExecutionPolicy Bypass -Command "cd /d '%~dp0'; npm.cmd run dev"
timeout /t 5 >nul
start "" http://127.0.0.1:3000/local-brain
exit /b 0
