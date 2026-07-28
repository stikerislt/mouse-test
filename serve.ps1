# Start a local web server so ES modules load correctly (file:// won't work in Chrome).
$port = 8080
$root = $PSScriptRoot

Write-Host ""
Write-Host "  Calibra — local server" -ForegroundColor Cyan
Write-Host "  Open: http://localhost:$port" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""

Set-Location $root

if (Get-Command python -ErrorAction SilentlyContinue) {
  python -m http.server $port
  exit $LASTEXITCODE
}

if (Get-Command py -ErrorAction SilentlyContinue) {
  py -m http.server $port
  exit $LASTEXITCODE
}

if (Get-Command npx -ErrorAction SilentlyContinue) {
  npx --yes serve . -l $port
  exit $LASTEXITCODE
}

Write-Host "Need Python or Node.js. Install one, then run this script again." -ForegroundColor Red
Write-Host "  Python: https://www.python.org/downloads/" -ForegroundColor Yellow
Write-Host "  Node:   https://nodejs.org/" -ForegroundColor Yellow
exit 1
