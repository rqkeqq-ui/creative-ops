@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-demo.ps1" %*
if "%~1"=="" pause