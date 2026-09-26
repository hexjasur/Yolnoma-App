# Run only when npm is installed. The --force flag is required by npm for cache cleanup.
if ($null -eq (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Output 'npm is not installed; cache cleanup skipped.'
} else {
    npm cache clean --force
    if ($LASTEXITCODE -ne 0) { throw 'npm cache cleanup failed.' }
}
