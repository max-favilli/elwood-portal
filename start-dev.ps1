# Start both the Elwood Runtime API and the Portal in parallel.
# Usage: .\start-dev.ps1
# Stop: Ctrl+C (kills both processes)

$ErrorActionPreference = "Stop"

$apiDir = "C:\GitAzureDevOpsRepos\Elwood\dotnet\src\Elwood.Runtime.Api"
$portalDir = "C:\GitAzureDevOpsRepos\elwood-portal"

Write-Host "Starting Elwood Runtime API (http://localhost:5000) ..." -ForegroundColor Cyan
# WorkingDirectory = API project dir so secrets.json and pipelines/ are found correctly
$api = Start-Process -NoNewWindow -PassThru -FilePath "dotnet" -ArgumentList "run" -WorkingDirectory $apiDir -RedirectStandardOutput "$env:TEMP\elwood-api.log" -RedirectStandardError "$env:TEMP\elwood-api-err.log"

Write-Host "Starting Elwood Portal (http://localhost:3000) ..." -ForegroundColor Cyan
$portal = Start-Process -NoNewWindow -PassThru -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory $portalDir

Write-Host ""
Write-Host "Both running. Open http://localhost:3000 in your browser." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop both." -ForegroundColor Yellow
Write-Host ""

try {
    $portal.WaitForExit()
} finally {
    Write-Host "Stopping API..." -ForegroundColor Yellow
    if (!$api.HasExited) { $api.Kill() }
    Write-Host "Done." -ForegroundColor Green
}
