# Clear Yarn's cache when Yarn is available on this device.
if ($null -eq (Get-Command yarn -ErrorAction SilentlyContinue)) {
    Write-Output 'Yarn is not installed; cache cleanup skipped.'
} else {
    yarn cache clean
    if ($LASTEXITCODE -ne 0) { throw 'Yarn cache cleanup failed.' }
}
