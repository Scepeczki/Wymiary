@echo off
rem Wymiary - installs the newest release from GitHub (same as Wymiary-instalator.exe).
rem Installs to LOCALAPPDATA\Programs\Wymiary and creates shortcuts. No admin rights needed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\install.ps1" %*
