@echo off
setlocal
cd /d "%~dp0"
call powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-local-brain-env.ps1"
if not "%ERRORLEVEL%"=="0" pause & exit /b %ERRORLEVEL%
"%~dp0.venv-local-brain\Scripts\python.exe" -m streamlit run "%~dp0local-brain\streamlit_app.py" --server.address 127.0.0.1 --server.port 8501
pause
