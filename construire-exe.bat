@echo off
chcp 65001 >nul
title Multipify Photo - construction du .exe
cd /d "%~dp0"
where npm >nul 2>nul || (echo Node.js n'est pas installe. Telechargez-le sur https://nodejs.org puis relancez ce fichier. & pause & exit /b 1)
echo Installation des dependances (quelques minutes la premiere fois)...
call npm install || (echo Echec de npm install & pause & exit /b 1)
echo Construction de l'installateur et de la version portable...
call npm run dist || (echo Echec de la construction & pause & exit /b 1)
echo.
echo Termine ! Vos fichiers .exe sont dans le dossier "dist".
start "" "%~dp0dist"
pause
