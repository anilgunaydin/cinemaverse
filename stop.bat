@echo off
chcp 65001 >nul 2>&1
title CinemaVerse - Sunucuyu Durdur
cd /d "%~dp0"

echo  [BILGI] CinemaVerse sunuculari araniyor...

powershell -NoProfile -Command ^
  "$procs = Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -like '*cinemaverse*' -and $_.CommandLine -like '*next*' }; if($procs){ $procs | ForEach-Object { Write-Output ('Killing PID ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } } else { Write-Output 'No process found' }"

echo.
echo  [OK] Sunucu durduruldu.
timeout /t 3 >nul
exit /b 0
