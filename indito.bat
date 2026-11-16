@echo off
title Zalaegerszeg helyi jarat szimulator
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nem talalhato. Telepitsd innen: https://nodejs.org/
  pause
  exit /b 1
)
node server.mjs
pause
