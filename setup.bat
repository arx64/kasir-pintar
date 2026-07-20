@echo off
chcp 65001 >nul
title Kasir Pintar - Setup Pertama Kali
cd /d "%~dp0"

echo ============================================
echo   KASIR PINTAR - SETUP PERTAMA KALI
echo ============================================
echo.

echo [1/4] Install dependency root...
call "D:\Program Files\nodejs\npm.cmd" install
if errorlevel 1 goto error

echo.
echo [2/4] Generate Prisma Client...
cd apps\api
call "D:\Program Files\nodejs\npx.cmd" prisma generate
if errorlevel 1 goto error

echo.
echo [3/4] Push schema ke database (SQLite)...
call "D:\Program Files\nodejs\npx.cmd" prisma db push
if errorlevel 1 goto error

echo.
echo [4/4] Seed database (akun + produk contoh)...
call "D:\Program Files\nodejs\npx.cmd" tsx prisma/seed.ts
if errorlevel 1 goto error

echo.
echo ============================================
echo   SETUP SELESAI!
echo ============================================
echo   Akun Owner : owner@kasir.com / owner123
echo   Akun Kasir : kasir@kasir.com / kasir123
echo.
echo   Selanjutnya: jalankan file run.bat
echo ============================================
pause
exit /b 0

:error
echo.
echo ============================================
echo   SETUP GAGAL! Cek error di atas.
echo ============================================
pause
exit /b 1