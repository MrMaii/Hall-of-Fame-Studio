@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Please install Node.js, then double-click this file again.
  pause
  exit /b 1
)
node scripts\start-local-app.mjs
if errorlevel 1 pause
