@echo off
cd /d "%~dp0"
echo Starting S-Aging simulation backend on http://localhost:8001
uvicorn main:app --reload --host 0.0.0.0 --port 8001
pause
