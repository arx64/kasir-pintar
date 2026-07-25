@echo off
chcp 65001 >nul
title Kasir Pintar - Production (Fast Load)
cd /d "%~dp0"

echo ============================================
echo   KASIR PINTAR - MODE PRODUKSI (CEPAT)
echo ============================================
echo   Build sekali, jalankan dengan next start.
echo   Load halaman pertama langsung cepat.
echo ============================================
echo.

echo [1/3] Build API (tsc)...
cd apps\api
call "D:\Program Files\nodejs\npx.cmd" tsc -p tsconfig.json
if errorlevel 1 goto error
cd /d "%~dp0"

echo.
echo [2/3] Build Web (next build)...
cd apps\web
call "D:\Program Files\nodejs\npx.cmd" next build
if errorlevel 1 goto error
cd /d "%~dp0"

echo.
echo [3/3] Jalankan server (API + Web produksi)...
echo   Web  : http://localhost:3000/login
echo   API  : http://localhost:4000/health
echo   Owner: owner@kasir.com / owner123
echo   Kasir: kasir@kasir.com / kasir123
echo.

start "Kasir Pintar - API" cmd /k "cd /d "%~dp0apps\api" && call "D:\Program Files\nodejs\node.exe" dist/index.js"
timeout /t 2 /nobreak >nul
start "Kasir Pintar - Web" cmd /k "cd /d "%~dp0apps\web" && call "D:\Program Files\nodejs\npx.cmd" next start -p 3000"

echo ============================================
echo   Server produksi sudah berjalan.
echo   - Tutup kedua jendela untuk berhenti.
echo ============================================
pause
exit /b 0

:error
echo.
echo ============================================
echo   BUILD GAGAL! Cek error di atas.
echo ============================================
pause
exit /b 1
