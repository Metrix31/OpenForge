@echo off
setlocal
chcp 65001 >nul
title OpenFetch
cd /d "%~dp0"
set "CLI=%~dp0src\cli\main.js"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js wurde nicht gefunden.
    echo Bitte installiere es von https://nodejs.org und starte diese Datei danach erneut.
    echo.
    pause
    exit /b 1
)

if not exist "openfetch.config.json" goto :setup
goto :menu

:setup
cls
echo ==========================================
echo   OpenFetch - Einrichtung
echo ==========================================
echo.
echo Von welchem GitHub-Repository sollen Dateien geladen werden?
echo Beispiel: github.com/OWNER/REPOSITORY
echo           Owner = OWNER, Repository = REPOSITORY
echo.
set "owner="
set "repo="
set /p "owner=Owner (Benutzer oder Organisation): "
set /p "repo=Repository-Name: "
if "%owner%"=="" goto :setup
if "%repo%"=="" goto :setup
> "openfetch.config.json" (
    echo {
    echo   "owner": "%owner%",
    echo   "repository": "%repo%"
    echo }
)
goto :menu

:menu
cls
echo ==========================================
echo   OpenFetch
echo ==========================================
echo.
echo   1  Neuestes Release anzeigen
echo   2  Alle Releases auflisten
echo   3  Datei herunterladen
echo   4  Download-Ordner oeffnen
echo   5  Repository aendern
echo   0  Beenden
echo.
set "choice="
set /p "choice=Auswahl: "
if "%choice%"=="1" goto :latest
if "%choice%"=="2" goto :releases
if "%choice%"=="3" goto :download
if "%choice%"=="4" goto :folder
if "%choice%"=="5" goto :setup
if "%choice%"=="0" goto :end
goto :menu

:latest
echo.
node "%CLI%" latest
goto :done

:releases
echo.
node "%CLI%" releases
goto :done

:download
echo.
node "%CLI%" assets
echo.
set "asset="
set "ver="
set /p "asset=Name der Datei (genau wie oben, Enter = zurück): "
if "%asset%"=="" goto :menu
set /p "ver=Version, z.B. v1.2.0 (Enter = neueste): "
echo.
if "%ver%"=="" (
    node "%CLI%" download "%asset%"
) else (
    node "%CLI%" download "%ver%" "%asset%"
)
goto :done

:folder
if not exist "%USERPROFILE%\Downloads\OpenFetch" mkdir "%USERPROFILE%\Downloads\OpenFetch"
explorer "%USERPROFILE%\Downloads\OpenFetch"
goto :menu

:done
echo.
pause
goto :menu

:end
endlocal
exit /b 0
