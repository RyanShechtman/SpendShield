@echo off

cd /d "%~dp0"

".venv\Scripts\python.exe" launch_live_demo.py --reset

pause

