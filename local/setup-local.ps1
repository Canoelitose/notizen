#requires -Version 5.1
<#
  setup-local.ps1 — Richtet die Notizen-App KOMPLETT LOKAL auf diesem Windows-PC
  ein und sorgt dafür, dass sie beim Anmelden automatisch startet.

  EINMAL als Administrator ausführen:
      Rechtsklick auf die Datei -> "Mit PowerShell ausführen" (als Admin)
    oder in einer Admin-PowerShell:
      powershell -ExecutionPolicy Bypass -File local\setup-local.ps1

  Was es macht:
    1. Node.js sicherstellen (per winget, falls nicht vorhanden)
    2. PostgreSQL sicherstellen (per winget; läuft danach als Windows-Dienst -> Autostart der DB)
    3. Datenbank + Benutzer + Schema anlegen
    4. app/.env schreiben (Verbindung auf 127.0.0.1)
    5. Admin-Login anlegen (fragt nach E-Mail + Passwort)
    6. Frontend kompilieren
    7. Autostart einrichten (Aufgabenplanung: beim Anmelden)
    8. App starten + Browser öffnen

  Parameter (optional):
    -AdminEmail / -AdminPassword   Erst-Login (sonst wird gefragt)
    -PgSuperPassword               Passwort des bestehenden 'postgres'-Superusers
                                   (nur nötig, wenn PostgreSQL schon installiert ist)
    -AppPort                       Standard 3000
#>
param(
  [string]$AdminEmail,
  [string]$AdminPassword,
  [string]$PgSuperPassword,
  [int]$AppPort = 3000,
  [int]$PgPort = 5432
)

$ErrorActionPreference = 'Stop'
function Info($m){ Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m){ Write-Host "    $m" -ForegroundColor Green }
function Warn($m){ Write-Host "    $m" -ForegroundColor Yellow }

# --- 0. Admin-Rechte prüfen --------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
          ).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
if (-not $isAdmin) { throw "Bitte als Administrator ausführen (Rechtsklick -> Als Administrator)." }

$RepoRoot = Split-Path -Parent $PSScriptRoot
$AppDir   = Join-Path $RepoRoot 'app'
$LocalDir = $PSScriptRoot
if (-not (Test-Path (Join-Path $AppDir 'server.js'))) { throw "app\server.js nicht gefunden — liegt das Skript unter local\ im Repo?" }

function Have($cmd){ [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function RandPass([int]$n=24){ -join ((48..57)+(65..90)+(97..122) | Get-Random -Count $n | ForEach-Object {[char]$_}) }

if (-not (Have 'winget')) { throw "winget (App-Installer) fehlt. Bitte aus dem Microsoft Store 'App Installer' installieren und erneut starten." }

# --- 1. Node.js --------------------------------------------------------------
Info "Node.js prüfen"
if (-not (Have 'node')) {
  Info "Installiere Node.js LTS (winget) …"
  winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
}
if (-not (Have 'node')) { throw "Node.js wurde installiert, ist aber noch nicht im PATH. PowerShell neu öffnen und Skript erneut starten." }
Ok ("Node " + (node -v))

# --- 2. PostgreSQL -----------------------------------------------------------
Info "PostgreSQL prüfen"
function Find-Psql {
  if (Have 'psql') { return (Get-Command psql).Source }
  $hit = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
         Sort-Object FullName -Descending | Select-Object -First 1
  if ($hit) { return $hit.FullName }
  return $null
}

$freshInstall = $false
$psql = Find-Psql
if (-not $psql) {
  if (-not $PgSuperPassword) { $PgSuperPassword = RandPass 20 }
  Info "Installiere PostgreSQL 16 (winget, unbeaufsichtigt) — dauert ein paar Minuten …"
  $override = "--mode unattended --unattendedmodeui none --superpassword `"$PgSuperPassword`" --serverport $PgPort --enable-components server,commandlinetools"
  winget install -e --id PostgreSQL.PostgreSQL.16 --silent --accept-package-agreements --accept-source-agreements --override $override
  Start-Sleep -Seconds 5
  $psql = Find-Psql
  if (-not $psql) { throw "PostgreSQL-Installation nicht gefunden. Bitte PowerShell neu öffnen und Skript erneut starten." }
  $freshInstall = $true
  Ok "PostgreSQL installiert (läuft als Windows-Dienst, startet automatisch mit Windows)."
} else {
  Ok "PostgreSQL bereits vorhanden: $psql"
  if (-not $PgSuperPassword) {
    $sec = Read-Host "Passwort des PostgreSQL-Superusers 'postgres' (leer lassen, falls lokal ohne Passwort)" -AsSecureString
    $PgSuperPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
      [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  }
}

# Sicherstellen, dass der Dienst läuft
Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Where-Object {$_.Status -ne 'Running'} | ForEach-Object {
  Info "Starte Dienst $($_.Name)"; Start-Service $_.Name
}

# --- 3. DB + Benutzer + Schema ----------------------------------------------
Info "Datenbank + Benutzer anlegen"
$DbName = 'notes_app'; $DbUser = 'notes_app'; $DbPass = RandPass 24
$env:PGPASSWORD = $PgSuperPassword
function Psql([string]$db, [string]$sql){ & $psql -U postgres -h 127.0.0.1 -p $PgPort -d $db -v ON_ERROR_STOP=1 -tAc $sql }

$roleExists = (Psql 'postgres' "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'")
if ($roleExists -ne '1') { Psql 'postgres' "CREATE ROLE $DbUser LOGIN PASSWORD '$DbPass'" | Out-Null; Ok "Benutzer $DbUser angelegt" }
else { Psql 'postgres' "ALTER ROLE $DbUser LOGIN PASSWORD '$DbPass'" | Out-Null; Ok "Benutzer ${DbUser}: Passwort gesetzt" }

$dbExists = (Psql 'postgres' "SELECT 1 FROM pg_database WHERE datname='$DbName'")
if ($dbExists -ne '1') { Psql 'postgres' "CREATE DATABASE $DbName OWNER $DbUser" | Out-Null; Ok "Datenbank $DbName angelegt" }
else { Ok "Datenbank $DbName existiert bereits" }
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

# --- 4. app/.env -------------------------------------------------------------
Info "app\.env schreiben"
$envText = @"
# Lokale Konfiguration (von setup-local.ps1 erzeugt). Nicht committen.
NODE_ENV=production
PORT=$AppPort
BIND_HOST=127.0.0.1
DB_HOST=127.0.0.1
DB_PORT=$PgPort
DB_NAME=$DbName
DB_USER=$DbUser
DB_PASS=$DbPass
COOKIE_SECURE=0
"@
Set-Content -Path (Join-Path $AppDir '.env') -Value $envText -Encoding UTF8 -NoNewline
Ok "Verbindung: 127.0.0.1:$PgPort/$DbName"

# Frische Installation: generiertes Superuser-Passwort sichern (gitignored)
if ($freshInstall) {
  $cred = "PostgreSQL Superuser 'postgres' Passwort: $PgSuperPassword`nDB-App-Passwort ($DbUser): $DbPass`n"
  Set-Content -Path (Join-Path $LocalDir 'notes-local-credentials.txt') -Value $cred -Encoding UTF8
  Warn "Passwörter gesichert in local\notes-local-credentials.txt (gitignored)."
}

# --- 5. npm install + Schema + Admin ----------------------------------------
Info "App-Abhängigkeiten installieren (npm install)"
Push-Location $AppDir
try {
  if (-not (Test-Path 'node_modules')) { npm install } else { Ok "node_modules vorhanden" }

  Info "Schema anlegen + Admin-Login"
  if (-not $AdminEmail)    { $AdminEmail = Read-Host "Admin E-Mail (zum Einloggen)" }
  if (-not $AdminPassword) {
    $sec = Read-Host "Admin Passwort (min. 8 Zeichen)" -AsSecureString
    $AdminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
      [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  }
  $env:ADMIN_EMAIL = $AdminEmail; $env:ADMIN_PASS = $AdminPassword
  node init-db.js
  Remove-Item Env:\ADMIN_EMAIL, Env:\ADMIN_PASS -ErrorAction SilentlyContinue

  Info "Frontend kompilieren"
  node build-jsx.js
}
finally { Pop-Location }

# --- 6. Autostart (Aufgabenplanung, beim Anmelden) --------------------------
Info "Autostart einrichten (beim Anmelden)"
$startScript = Join-Path $LocalDir 'start-local.ps1'
$taskName = 'NotesApp-Local'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Ok "Aufgabe '$taskName' registriert — App startet künftig automatisch beim Anmelden."

# --- 7. Jetzt starten + Browser ---------------------------------------------
Info "App starten"
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3
Start-Process "http://127.0.0.1:$AppPort"

Write-Host ""
Write-Host "Fertig. Die Notizen-App läuft lokal:  http://127.0.0.1:$AppPort" -ForegroundColor Green
Write-Host "Login: $AdminEmail" -ForegroundColor Green
Write-Host "Stoppen/entfernen: local\uninstall-local.ps1" -ForegroundColor DarkGray
