@echo off
rem Wymiary - install from this folder (for example after Code / Download ZIP on GitHub).
rem Copies the game to LOCALAPPDATA\Programs\Wymiary and creates shortcuts. No admin rights needed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\install.ps1" %*
