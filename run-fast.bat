@echo off
chcp 65001 >nul
title Kasir Pintar - Jalankan (Fast / Turbo)
cd /d "%~dp0"

echo ============================================
echo   KASIR PINTAR - DEV MODE CEPAT (TURBO)
echo ============================================
echo   Web pakai next dev --turbo  (compile cepat)
echo   API pakai tsx watch
echo ============================================
echo.
echo   Web  : http://localhost:3000/login
echo   API  : http://localhost:4000/health
echo.
echo   Owner: owner@kasir.com / owner123
echo   Kasir: kasir@kasir.com / kasir123
echo.

start "Kasir Pintar - API" cmd /k "cd /d "%~dp0apps\api" && call "D:\Program Files\nodejs\npx.cmd" tsx watch src/index.ts"
timeout /t 3 /nobreak >nul
start "Kasir Pintar - Web" cmd /k "cd /d "%~dp0apps\web" && call "D:\Program Files\nodejs\npx.cmd" next dev --turbo -p 3000"

echo.
echo ============================================
echo   DUA SERVER SUDAH DIBUKA.
echo   - Jangan tutup kedua jendela itu.
echo   - Buka browser: http://localhost:3000/login
echo ============================================
echo.
echo   Catatan:
echo   - Stop server: tutup jendela API & Web,
echo     atau tekan Ctrl+C di masing-masing.
echo ============================================
pause
exit /b 0
