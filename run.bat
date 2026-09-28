@echo off
title Gemini Photo Restorer & Upscaler
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [!] Virtual environment not found. Setting up...
    python -m venv .venv
    .\.venv\Scripts\pip.exe install -r requirements.txt
)

.\.venv\Scripts\python.exe restore_images.py %*
pause
