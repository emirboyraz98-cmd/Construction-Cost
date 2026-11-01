@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js bulunamadi. & pause & exit /b 1)
echo Programi kapattiginizdan emin olun (program penceresinde Ctrl + C).
node scripts\with-db.mjs -- scripts/restore.mjs
pause
