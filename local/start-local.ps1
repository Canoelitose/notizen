#requires -Version 5.1
<#
  start-local.ps1 — startet die lokale Notizen-App.
  Wird von der Autostart-Aufgabe (beim Anmelden) aufgerufen, kann aber auch
  von Hand gestartet werden:  powershell -ExecutionPolicy Bypass -File local\start-local.ps1

  Die Datenbank läuft als eigener Windows-Dienst und startet selbst — hier wird
  nur sichergestellt, dass sie an ist, und dann der App-Server gestartet.
#>
$ErrorActionPreference = 'Continue'
$AppDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'app'

# PostgreSQL-Dienst sicherheitshalber starten (falls nicht schon gestartet).
Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue |
  Where-Object { $_.Status -ne 'Running' } |
  ForEach-Object { try { Start-Service $_.Name } catch {} }

Set-Location $AppDir

# Schema idempotent sicherstellen (z.B. nach einem Update) und App starten.
try { node init-db.js } catch { Write-Warning "init-db übersprungen: $_" }
node server.js
