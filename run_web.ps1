# PowerShell Web Launcher for Lumina 8K
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "[!] Setting up virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
    .\.venv\Scripts\pip.exe install -r requirements.txt
}

.\.venv\Scripts\python.exe server.py
