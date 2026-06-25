#requires -Version 5.1
<#
  db-tunnel.ps1 — öffnet einen lokalen Port zur entfernten PostgreSQL über einen
  Cloudflare-Tunnel. Die App verbindet sich danach gegen 127.0.0.1:<Port>.

      powershell -ExecutionPolicy Bypass -File db-tunnel.ps1 -Hostname db.example.com [-Port 5432]

  Voraussetzung: cloudflared installiert (winget install -e --id Cloudflare.cloudflared)
  und serverseitig <Hostname> als TCP-Ingress auf Postgres geroutet (siehe README.md).
#>
param(
  [Parameter(Mandatory=$true)][string]$Hostname,
  [int]$Port = 5432,
  [string]$ClientId    = $env:CF_ACCESS_CLIENT_ID,
  [string]$ClientSecret = $env:CF_ACCESS_CLIENT_SECRET
)
$ErrorActionPreference = 'Stop'

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw "cloudflared fehlt. Installieren: winget install -e --id Cloudflare.cloudflared"
}

$args = @('access','tcp','--hostname', $Hostname, '--url', "127.0.0.1:$Port")
if ($ClientId -and $ClientSecret) {
  $args += @('--service-token-id', $ClientId, '--service-token-secret', $ClientSecret)
}

Write-Host "Tunnel: 127.0.0.1:$Port  ->  $Hostname  (Strg+C zum Beenden)" -ForegroundColor Cyan
Write-Host "App-Verbindung: DB_HOST=127.0.0.1 DB_PORT=$Port" -ForegroundColor DarkGray
& cloudflared @args
