@echo off
rem started by the self-extracting package (IExpress) from its temporary folder
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
