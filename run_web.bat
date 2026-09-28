@echo off
title Lumina 8K - Gemini Photo Restorer Web App
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [!] Setting up virtual environment...
    python -m venv .venv
    .\.venv\Scripts\pip.exe install -r requirements.txt
)

.\.venv\Scripts\python.exe server.py
pause
