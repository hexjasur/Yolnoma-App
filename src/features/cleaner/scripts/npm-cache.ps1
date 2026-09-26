# Use npm.cmd directly so PowerShell execution policy does not block the npm.ps1 shim.
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($null -eq $npm) {
    Write-Output 'npm is not installed; cache cleanup skipped.'
} else {
    & npm.cmd cache clean --force
    if ($LASTEXITCODE -ne 0) { throw "npm cache cleanup failed (exit code $LASTEXITCODE)." }
}
