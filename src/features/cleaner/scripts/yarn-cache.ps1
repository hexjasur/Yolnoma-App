# Use the Windows command shim to avoid PowerShell script execution-policy restrictions.
$yarn = Get-Command yarn.cmd -ErrorAction SilentlyContinue
if ($null -eq $yarn) {
    Write-Output 'Yarn is not installed; cache cleanup skipped.'
} else {
    & yarn.cmd cache clean
    if ($LASTEXITCODE -ne 0) { throw "Yarn cache cleanup failed (exit code $LASTEXITCODE)." }
}
