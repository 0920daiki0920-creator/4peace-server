@echo off
setlocal

set "GAME_FILE=%~dp04peace-ws-3-2.html"

if not exist "%GAME_FILE%" (
  echo [ERROR] Game file not found:
  echo %GAME_FILE%
  pause
  exit /b 1
)

start "" "%GAME_FILE%"
exit /b 0
