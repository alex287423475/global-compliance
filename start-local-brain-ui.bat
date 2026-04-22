@echo off
setlocal
cd /d "%~dp0"
python -m streamlit run "%~dp0local-brain\streamlit_app.py" --server.address 127.0.0.1 --server.port 8501
pause
