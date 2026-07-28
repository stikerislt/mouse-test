# Start a local web server so ES modules load correctly (file:// won't work in Chrome).
param([int]$Port = 0)

$root = $PSScriptRoot
Set-Location $root

function Test-PortFree([int]$p) {
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $p)
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    return $false
  }
}

function Get-FreePort {
  param([int[]]$Candidates)
  foreach ($p in $Candidates) {
    if (Test-PortFree $p) { return $p }
  }
  return 0
}

$candidates = if ($Port -gt 0) { @($Port) } else { @(5500, 3000, 8888, 5173, 9000, 8080) }
$port = Get-FreePort -Candidates $candidates

if ($port -eq 0) {
  Write-Host 'Could not find a free port. Close other apps or run:' -ForegroundColor Red
  Write-Host '  .\serve.ps1 -Port 12345' -ForegroundColor Yellow
  exit 1
}

Write-Host ''
Write-Host '  Calibra - local server' -ForegroundColor Cyan
Write-Host "  Open: http://localhost:$port" -ForegroundColor Green
Write-Host '  Press Ctrl+C to stop' -ForegroundColor DarkGray
Write-Host ''

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

Write-Host 'Need Python or Node.js. Install one, then run this script again.' -ForegroundColor Red
Write-Host '  Python: https://www.python.org/downloads/' -ForegroundColor Yellow
Write-Host '  Node:   https://nodejs.org/' -ForegroundColor Yellow
exit 1
