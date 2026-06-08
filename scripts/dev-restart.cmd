@echo off
setlocal
set PORT=3004

echo Stopping any process listening on port %PORT%...

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  taskkill /F /PID %%P >nul 2>&1
)

ping -n 2 127.0.0.1 >nul
echo Starting dev server on port %PORT%...
call npm run dev
