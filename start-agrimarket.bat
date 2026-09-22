@echo off
title AgriMart Ghana
echo.
echo  Starting AgriMart Ghana...
echo  (Make sure the PostgreSQL service is running.)
echo.

start "AgriMart API  - http://localhost:5000" cmd /k "cd /d "%~dp0agrimarket-backend" && npm run dev"
start "AgriMart Web  - http://localhost:3000" cmd /k "cd /d "%~dp0agrimarket-frontend" && npm run dev"

echo  Waiting for the servers to come up...
timeout /t 20 /nobreak >nul

start "" http://localhost:3000
echo.
echo  Website:        http://localhost:3000
echo  Admin console:  http://localhost:3000/admin
echo  API:            http://localhost:5000/api/v1
echo.
echo  Close the two server windows to stop the platform.
echo.
