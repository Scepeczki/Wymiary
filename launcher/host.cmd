@echo off
rem Wymiary - start the network game server on this computer (and open the game).
title Wymiary - serwer gry sieciowej
cd /d "%~dp0.."
set "NODE=node"
if exist "runtime\node.exe" set "NODE=runtime\node.exe"
"%NODE%" --version >nul 2>nul && goto run
echo Do hostowania gry potrzebny jest Node.js. Pobieram wersje przenosna (tylko dla gry, nic nie instaluje)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0get-node.ps1" || (echo Nie udalo sie pobrac Node.js. & pause & exit /b)
set "NODE=runtime\node.exe"
:run
"%NODE%" server\server.js --open %*
pause
