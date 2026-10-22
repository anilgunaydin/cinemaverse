@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title CinemaVerse - Sinema Hafizasi
cd /d "%~dp0"

echo.
echo  ==========================================================
echo    CINEMAVERSE - Kisisel Sinema Hafizasi
echo  ==========================================================
echo.

REM ---------------------------------------------------------------- Node.js
where node >nul 2>&1
if errorlevel 1 (
  echo  [HATA] Node.js bulunamadi.
  echo         Lutfen https://nodejs.org adresinden Node.js 20+ kurun
  echo         ve terminali yeniden baslatin.
  echo.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  [OK] Node.js !NODE_VER!

REM ---------------------------------------------------------------- klasor
if not exist "node_modules" (
  echo  [BILGI] Bagimliliklar kuruluyor - birkac dakika surebilir
  call npm install
  if errorlevel 1 (
    echo  [HATA] Bagimliliklar kurulamadi.
    pause
    exit /b 1
  )
  echo  [OK] Bagimliliklar kuruldu
) else (
  echo  [OK] Bagimliliklar mevcut
)

REM ---------------------------------------------------------------- .env
if not exist ".env" (
  echo  [BILGI] .env bulunamadi - .env.example kopyalaniyor
  copy ".env.example" ".env" >nul
  echo  [UYARI] .env olusturuldu. Lutfen API anahtarlarini .env icine girin.
)

REM ---------------------------------------------------------------- AI
REM Yerel Ollama destegi kaldirildi. AI saglayicisi .env icindeki
REM AI_PROVIDER (gemini | openai-compatible | none) ile belirlenir.
echo  [BILGI] AI: .env -> AI_PROVIDER (varsayilan: none / kapali)

REM ---------------------------------------------------------------- migrations
echo  [BILGI] Veritabani migrasyonlari uygulaniyor...
call npx tsx scripts\apply-migrations.ts
if errorlevel 1 (
  echo  [UYARI] Migrasyonlar uygulanamadi - devam ediliyor
)

REM ---------------------------------------------------------------- port kontrolu
set PORT_STATE=free
powershell -NoProfile -Command "if(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue){Write-Output 'busy'}" > "%TEMP%\cv_port.txt" 2>nul
if exist "%TEMP%\cv_port.txt" set /p PORT_STATE=<"%TEMP%\cv_port.txt"
del "%TEMP%\cv_port.txt" >nul 2>&1

if /i "%PORT_STATE%"=="busy" (
  echo  [BILGI] Port 3000 zaten kullanimda - mevcut sunucu kullanilacak
  echo.
  echo  [BILGI] Tarayici aciliyor...
  start "" "http://localhost:3000/"
  echo  [OK] Hazir. Sunucuyu durdurmak icin stop.bat calistirin.
  echo.
  pause
  exit /b 0
)

REM ---------------------------------------------------------------- sunucu
echo.
echo  [BILGI] Gelistirme sunucusu baslatiliyor - http://localhost:3000
echo         Durdurmak icin bu pencereyi kapatin veya Ctrl+C.
echo.

start "" "http://localhost:3000/"
call npm run dev

echo.
echo  [BILGI] Sunucu durdu.
pause
