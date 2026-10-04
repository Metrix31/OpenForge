$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "        OpenFetch Installer        " -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# --------------------------------------------------
# Paths
# --------------------------------------------------

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$MainFile = Join-Path $ProjectDir "src\cli\main.js"

$InstallDir = Join-Path $env:LOCALAPPDATA "OpenFetch\bin"
$Launcher = Join-Path $InstallDir "openfetch.cmd"

# --------------------------------------------------
# Check Node.js
# --------------------------------------------------

Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow

try {
    $nodeVersion = node --version 2>$null
}
catch {
    $nodeVersion = $null
}

if (-not $nodeVersion) {
    Write-Host ""
    Write-Host "ERROR: Node.js was not found." -ForegroundColor Red
    Write-Host "Install Node.js 18 or newer first."
    exit 1
}

$nodeMajor = [int]($nodeVersion -replace '^v(\d+).*', '$1')

if ($nodeMajor -lt 18) {
    Write-Host ""
    Write-Host "ERROR: OpenFetch requires Node.js 18 or newer." -ForegroundColor Red
    Write-Host "Found: $nodeVersion"
    exit 1
}

Write-Host "Node.js $nodeVersion found." -ForegroundColor Green

# --------------------------------------------------
# Check OpenFetch
# --------------------------------------------------

Write-Host "[2/5] Checking OpenFetch..." -ForegroundColor Yellow

if (-not (Test-Path $MainFile)) {
    Write-Host ""
    Write-Host "ERROR: OpenFetch CLI was not found:" -ForegroundColor Red
    Write-Host $MainFile
    exit 1
}

Write-Host "OpenFetch CLI found." -ForegroundColor Green

# --------------------------------------------------
# Create installation directory
# --------------------------------------------------

Write-Host "[3/5] Creating installation directory..." -ForegroundColor Yellow

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

# --------------------------------------------------
# Create launcher
# --------------------------------------------------

Write-Host "[4/5] Creating openfetch command..." -ForegroundColor Yellow

$LauncherContent = @"
@echo off
node "$MainFile" %*
exit /b %errorlevel%
"@

Set-Content -Path $Launcher -Value $LauncherContent -Encoding ASCII

Write-Host "Created:" -ForegroundColor Green
Write-Host "  $Launcher"

# --------------------------------------------------
# Add to user PATH
# --------------------------------------------------

Write-Host "[5/5] Updating PATH..." -ForegroundColor Yellow

$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")

if (-not $UserPath) {
    $UserPath = ""
}

$PathEntries = $UserPath -split ";" | Where-Object {
    $_ -and $_.Trim() -ne ""
}

if ($PathEntries -notcontains $InstallDir) {
    if ($UserPath.TrimEnd(";") -ne "") {
        $NewPath = $UserPath.TrimEnd(";") + ";" + $InstallDir
    }
    else {
        $NewPath = $InstallDir
    }

    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")

    Write-Host "Added OpenFetch to your user PATH." -ForegroundColor Green
}
else {
    Write-Host "OpenFetch is already in your PATH." -ForegroundColor Green
}

# --------------------------------------------------
# Finish
# --------------------------------------------------

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "       Installation complete!      " -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Open a NEW CMD or PowerShell window." -ForegroundColor Yellow
Write-Host ""
Write-Host "Then try:" -ForegroundColor White
Write-Host ""
Write-Host "  openfetch --version"
Write-Host "  openfetch --help"
Write-Host "  openfetch latest"
Write-Host "  openfetch releases"
Write-Host ""

# Try to update PATH for this PowerShell session too
$env:Path = $env:Path + ";" + $InstallDir

Write-Host "Testing OpenFetch..." -ForegroundColor Yellow
Write-Host ""

& $Launcher --version

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "OpenFetch is ready!" -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "OpenFetch was installed, but the test returned an error." -ForegroundColor Yellow
}
