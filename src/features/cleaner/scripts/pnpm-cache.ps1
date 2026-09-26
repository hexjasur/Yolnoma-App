# Use the Windows command shim to avoid PowerShell script execution-policy restrictions.
$pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($null -eq $pnpm) {
    Write-Output 'pnpm is not installed; cache cleanup skipped.'
} else {
    & pnpm.cmd store prune
    if ($LASTEXITCODE -ne 0) { throw "pnpm store cleanup failed (exit code $LASTEXITCODE)." }
}
