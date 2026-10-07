# Start the sibling Runtime API and this portal. Ctrl+C stops both.
$ErrorActionPreference = "Stop"
Push-Location $PSScriptRoot
try {
    node scripts/start-dev.mjs
    if ($LASTEXITCODE -ne 0) { throw "Development servers exited with code $LASTEXITCODE" }
} finally {
    Pop-Location
}
