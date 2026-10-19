[CmdletBinding()]
param(
    [switch]$SkipBrowser
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$atlasUrl = 'http://127.0.0.1:5173/'
$atlasTitle = '<title>ATLAS | Investment Research Terminal</title>'
$startupTimeoutSeconds = 45

function Write-LauncherError([string]$Message) {
    Write-Host "ERROR: $Message" -ForegroundColor Red
}

function Get-AtlasServerState {
    try {
        $response = Invoke-WebRequest -Uri $atlasUrl -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200 -and $response.Content.Contains($atlasTitle)) {
            return 'atlas'
        }
        return 'occupied'
    }
    catch {
        return 'available'
    }
}

function Show-ServerFailureLogs([string]$OutputPath, [string]$ErrorPath) {
    if (Test-Path -LiteralPath $ErrorPath) {
        $details = Get-Content -LiteralPath $ErrorPath -Tail 12 -ErrorAction SilentlyContinue
        if ($details) {
            Write-Host "Server error log ($ErrorPath):" -ForegroundColor Yellow
            $details | ForEach-Object { Write-Host $_ }
        }
    }
    elseif (Test-Path -LiteralPath $OutputPath) {
        Write-Host "Server output log: $OutputPath" -ForegroundColor Yellow
    }
}

Write-Host 'Starting ATLAS Research Terminal...'
Write-Host '=================================== '

try {
    Set-Location -LiteralPath $scriptDir

    $node = Get-Command node.exe -ErrorAction Stop
    $npm = Get-Command npm.cmd -ErrorAction Stop
    Write-Host "Node.js: $(& $node.Source --version)"
    Write-Host "npm: $(& $npm.Source --version)"

    if (-not (Test-Path -LiteralPath (Join-Path $scriptDir 'package.json')) -or
        -not (Test-Path -LiteralPath (Join-Path $scriptDir 'package-lock.json'))) {
        throw 'package.json or package-lock.json is missing. Run the launcher from a complete ATLAS clone.'
    }

    $viteCommand = Join-Path $scriptDir 'node_modules\.bin\vite.cmd'
    $vitestCommand = Join-Path $scriptDir 'node_modules\.bin\vitest.cmd'
    if (-not (Test-Path -LiteralPath $viteCommand) -or -not (Test-Path -LiteralPath $vitestCommand)) {
        Write-Host 'Installing locked project dependencies...'
        & $npm.Source ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            throw "npm.cmd ci failed with exit code $LASTEXITCODE. Check network access and npm configuration."
        }
    }

    Write-Host 'Running the ATLAS test suite...'
    & $npm.Source test
    if ($LASTEXITCODE -ne 0) {
        throw "Tests failed with exit code $LASTEXITCODE. The server was not started."
    }

    $initialState = Get-AtlasServerState
    if ($initialState -eq 'occupied') {
        throw 'Port 5173 is already serving a different application. Stop that process or change its port, then retry.'
    }

    if ($initialState -eq 'atlas') {
        Write-Host 'ATLAS is already running on port 5173; no duplicate server was started.' -ForegroundColor Green
    }
    else {
        $stdoutLog = Join-Path $env:TEMP 'atlas-vite-output.log'
        $stderrLog = Join-Path $env:TEMP 'atlas-vite-error.log'
        Write-Host 'Starting the local ATLAS server in the background...'
        $serverProcess = Start-Process -FilePath $npm.Source -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1') -WorkingDirectory $scriptDir -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru

        $ready = $false
        $deadline = (Get-Date).AddSeconds($startupTimeoutSeconds)
        while ((Get-Date) -lt $deadline) {
            Start-Sleep -Milliseconds 500
            $serverProcess.Refresh()
            if ($serverProcess.HasExited) {
                Show-ServerFailureLogs -OutputPath $stdoutLog -ErrorPath $stderrLog
                throw "The ATLAS server exited during startup with code $($serverProcess.ExitCode)."
            }
            $state = Get-AtlasServerState
            if ($state -eq 'atlas') {
                $ready = $true
                break
            }
            if ($state -eq 'occupied') {
                throw 'Port 5173 became occupied by a non-ATLAS service during startup.'
            }
        }

        if (-not $ready) {
            Show-ServerFailureLogs -OutputPath $stdoutLog -ErrorPath $stderrLog
            throw "ATLAS did not become ready within $startupTimeoutSeconds seconds."
        }
        Write-Host "ATLAS server is ready (launcher process $($serverProcess.Id))." -ForegroundColor Green
    }

    if (-not $SkipBrowser) {
        Write-Host 'Opening ATLAS in the default browser...'
        Start-Process -FilePath $atlasUrl
    }
    else {
        Write-Host 'Browser opening skipped by request.'
    }

    Write-Host "ATLAS is available at $atlasUrl" -ForegroundColor Green
    exit 0
}
catch {
    Write-LauncherError $_.Exception.Message
    exit 1
}
