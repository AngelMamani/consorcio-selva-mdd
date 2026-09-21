@echo off
setlocal
cd /d "%~dp0\..\.."

REM Datos Canon oficina
set SCAN_DRIVER=wia
set SCAN_SOURCE=feeder
set SCAN_DEVICE=Color Network ScanGear 2
set TWAIN_DRIVER=Color Network ScanGear 2
set PRINTER_IP=192.168.0.121
set PRINTER_PORT=9100
set DEVICE_BRIDGE_PORT=5000

REM Buscar NAPS2.Console.exe en rutas habituales
if exist "%ProgramFiles%\NAPS2\NAPS2.Console.exe" set "NAPS2_PATH=%ProgramFiles%\NAPS2\NAPS2.Console.exe"
if exist "%ProgramFiles(x86)%\NAPS2\NAPS2.Console.exe" set "NAPS2_PATH=%ProgramFiles(x86)%\NAPS2\NAPS2.Console.exe"
if exist "%LocalAppData%\Programs\NAPS2\NAPS2.Console.exe" set "NAPS2_PATH=%LocalAppData%\Programs\NAPS2\NAPS2.Console.exe"
if exist "%LocalAppData%\Microsoft\WindowsApps\NAPS2.Console.exe" set "NAPS2_PATH=%LocalAppData%\Microsoft\WindowsApps\NAPS2.Console.exe"

echo.
echo === Consorcio · Bridge Canon ===
echo Puerto: %DEVICE_BRIDGE_PORT%
echo Impresora: %PRINTER_IP%:%PRINTER_PORT%
echo TWAIN: %TWAIN_DRIVER%
if defined NAPS2_PATH (
  echo NAPS2: %NAPS2_PATH%
) else (
  echo NAPS2: no encontrado - usara carpeta inbox
  echo Inbox: %cd%\tool\local-device-bridge\inbox
)
echo.
echo Deja esta ventana ABIERTA mientras trabajas en la web.
echo.

node tool\local-device-bridge\server.mjs
pause
