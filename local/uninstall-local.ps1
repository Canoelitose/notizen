#requires -Version 5.1
<#
  uninstall-local.ps1 — entfernt den Autostart und stoppt die laufende App.
  PostgreSQL, die Datenbank und deine Notizen bleiben erhalten.

      powershell -ExecutionPolicy Bypass -File local\uninstall-local.ps1

  Komplett alles weg (auch Daten):  zusätzlich -PurgeData
#>
param([switch]$PurgeData)
$ErrorActionPreference = 'Continue'

$taskName = 'NotesApp-Local'
Write-Host "==> Autostart-Aufgabe entfernen" -ForegroundColor Cyan
try { Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue } catch {}
try { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop; Write-Host "    entfernt." -ForegroundColor Green }
catch { Write-Host "    keine Aufgabe '$taskName' gefunden." -ForegroundColor Yellow }

Write-Host "==> Laufenden App-Server stoppen" -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'server\.js' } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force; Write-Host "    node (PID $($_.ProcessId)) gestoppt." -ForegroundColor Green } catch {} }

if ($PurgeData) {
  Write-Host "==> -PurgeData: Datenbank 'notes_app' löschen" -ForegroundColor Cyan
  $hit = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
         Sort-Object FullName -Descending | Select-Object -First 1
  if ($hit) {
    $sec = Read-Host "Passwort des PostgreSQL-Superusers 'postgres'" -AsSecureString
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    & $hit.FullName -U postgres -h 127.0.0.1 -c "DROP DATABASE IF EXISTS notes_app;" 2>$null
    & $hit.FullName -U postgres -h 127.0.0.1 -c "DROP ROLE IF EXISTS notes_app;" 2>$null
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    Write-Host "    Datenbank + Benutzer gelöscht." -ForegroundColor Green
  } else { Write-Host "    psql nicht gefunden — übersprungen." -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "Fertig. (PostgreSQL-Dienst selbst wurde nicht deinstalliert.)" -ForegroundColor Green
