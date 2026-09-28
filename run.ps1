# PowerShell Launcher for Gemini Photo Restorer
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "[!] Virtual environment not found. Setting up..." -ForegroundColor Yellow
    python -m venv .venv
    .\.venv\Scripts\pip.exe install -r requirements.txt
}

.\.venv\Scripts\python.exe restore_images.py @args
