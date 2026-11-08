@echo off
rem Start the Ear Training web app at http://127.0.0.1:8765/
cd /d "%~dp0"
python server.py %*
if errorlevel 1 pause
