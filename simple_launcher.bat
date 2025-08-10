@echo off
echo ========================================
echo   Simple Launcher - Odoo Invoice Manager
echo ========================================
echo.

echo Starting Backend Server...
start "Backend" cmd /k "cd /d %~dp0 && python backend/run_backend.py"

echo Waiting 10 seconds for backend...
timeout /t 10 /nobreak >nul

echo Starting Frontend Server...
start "Frontend" cmd /k "cd /d %~dp0 && npm start"

echo Waiting 5 seconds for frontend...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   Both servers started!
echo ========================================
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo The browser should open automatically when React starts.
echo Close the terminal windows to stop the servers.
echo.
pause 