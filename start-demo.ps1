#Requires -Version 5.1
<#
.SYNOPSIS
  One-click demo launcher: Next.js production server + public Cloudflare quick tunnel.

.DESCRIPTION
  Starts the already built Next.js app on the given port, waits until it is healthy,
  then opens a public https://<random>.trycloudflare.com tunnel and prints the URL.
  The URL is also saved to logs\demo-url.txt and copied to the clipboard.

.PARAMETER Port
  Local port for the Next.js server. Default: 3200.

.PARAMETER Build
  Force "npm run build" before starting (by default it builds only when .next is missing).

.PARAMETER NoTunnel
  Start only the local server, without a public tunnel.

.PARAMETER Stop
  Stop the previously started server and tunnel and exit.

.EXAMPLE
  .\start-demo.ps1
  .\start-demo.ps1 -Port 3201 -Build
  .\start-demo.ps1 -Stop
#>
[CmdletBinding()]
param(
  [int]$Port = 3200,
  [switch]$Build,
  [switch]$NoTunnel,
  [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$serverPidFile = Join-Path $logDir 'server.pid'
$tunnelPidFile = Join-Path $logDir 'tunnel.pid'
$urlFile = Join-Path $logDir 'demo-url.txt'
$tunnelLog = Join-Path $logDir 'tunnel.log'
$cloudflared = Join-Path $root 'tools\cloudflared.exe'

function Write-Step($text) { Write-Host "==> $text" -ForegroundColor Cyan }

function Stop-FromPidFile($file) {
  if (-not (Test-Path $file)) { return }
  $id = (Get-Content $file -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($id) {
    Stop-Process -Id ([int]$id) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $file -Force -ErrorAction SilentlyContinue
}

function Stop-PortListener($port) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

function Wait-Health($url, $timeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -eq 200) { return $true }
    } catch {
      Start-Sleep -Milliseconds 700
    }
  }
  return $false
}

function Ensure-Cloudflared {
  if (Test-Path $cloudflared) { return }
  Write-Step 'cloudflared.exe not found, downloading (one time)...'
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $cloudflared) | Out-Null
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
  Invoke-WebRequest -Uri $url -OutFile $cloudflared -UseBasicParsing
}

if ($Stop) {
  Write-Step 'Stopping demo server and tunnel'
  Stop-FromPidFile $tunnelPidFile
  Stop-FromPidFile $serverPidFile
  Stop-PortListener $Port
  Remove-Item $urlFile -Force -ErrorAction SilentlyContinue
  Write-Host 'Stopped.' -ForegroundColor Green
  exit 0
}

Write-Step "CreativeOps demo on port $Port"

if ($Build -or -not (Test-Path (Join-Path $root '.next\BUILD_ID'))) {
  Write-Step 'Building production bundle (npm run build)'
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "Build failed with exit code $LASTEXITCODE" }
}

Write-Step 'Restarting the local server'
Stop-FromPidFile $tunnelPidFile
Stop-FromPidFile $serverPidFile
Stop-PortListener $Port
Start-Sleep -Seconds 1

$server = Start-Process -FilePath 'node' `
  -ArgumentList 'node_modules/next/dist/bin/next', 'start', '-p', "$Port" `
  -WorkingDirectory $root `
  -RedirectStandardOutput (Join-Path $logDir 'server.log') `
  -RedirectStandardError (Join-Path $logDir 'server.err.log') `
  -WindowStyle Hidden -PassThru
Set-Content -Path $serverPidFile -Value $server.Id -Encoding ascii

$localUrl = "http://127.0.0.1:$Port"
if (-not (Wait-Health "$localUrl/api/health" 90)) {
  throw "Server did not become healthy on $localUrl. See logs\server.err.log"
}
Write-Host "    local: $localUrl" -ForegroundColor Green

if ($NoTunnel) {
  Write-Step 'Tunnel skipped (-NoTunnel)'
  exit 0
}

Ensure-Cloudflared

Write-Step 'Opening public Cloudflare tunnel'
Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue
$tunnel = Start-Process -FilePath $cloudflared `
  -ArgumentList 'tunnel', '--url', $localUrl, '--no-autoupdate' `
  -WorkingDirectory $root `
  -RedirectStandardOutput (Join-Path $logDir 'tunnel.out.log') `
  -RedirectStandardError $tunnelLog `
  -WindowStyle Hidden -PassThru
Set-Content -Path $tunnelPidFile -Value $tunnel.Id -Encoding ascii

$publicUrl = $null
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 500
  if (Test-Path $tunnelLog) {
    $match = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($match) { $publicUrl = $match.Matches[0].Value; break }
  }
  if ($tunnel.HasExited) { break }
}

if (-not $publicUrl) {
  throw "Tunnel URL was not issued. See $tunnelLog"
}

Set-Content -Path $urlFile -Value $publicUrl -Encoding ascii
Set-Clipboard -Value $publicUrl -ErrorAction SilentlyContinue

if (Wait-Health "$publicUrl/api/health" 45) {
  Write-Host "    public: $publicUrl" -ForegroundColor Green
} else {
  Write-Host "    public: $publicUrl (tunnel is up, but health check is still warming up)" -ForegroundColor Yellow
}

Write-Host ''
Write-Host "Link copied to clipboard. Saved in logs\demo-url.txt" -ForegroundColor DarkGray
Write-Host "To stop everything: .\start-demo.ps1 -Stop" -ForegroundColor DarkGray