@echo off
title AgriMart Ghana - first-time setup
echo.
echo  =========================================================
echo   AgriMart Ghana - first-time setup
echo  =========================================================
echo.
echo  Before continuing, make sure the PostgreSQL service is running.
echo.
pause

echo.
echo  [1/3] Installing backend packages...
cd /d "%~dp0agrimarket-backend"
call npm install
if errorlevel 1 goto failed

echo.
echo  [2/3] Creating the database and loading Ghana reference data...
call npm run setup
if errorlevel 1 goto failed

echo.
echo  [3/3] Installing frontend packages...
cd /d "%~dp0agrimarket-frontend"
call npm install
if errorlevel 1 goto failed

echo.
echo  Setup complete. Run start-agrimarket.bat to launch the platform.
echo.
pause
exit /b 0

:failed
echo.
echo  Setup stopped because a step failed. Read the messages above.
echo  The most common cause is PostgreSQL not running.
echo.
pause
exit /b 1
