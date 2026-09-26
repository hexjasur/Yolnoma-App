# Prune unreferenced packages from pnpm's shared content-addressable store.
if ($null -eq (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Output 'pnpm is not installed; cache cleanup skipped.'
} else {
    pnpm store prune
    if ($LASTEXITCODE -ne 0) { throw 'pnpm cache cleanup failed.' }
}
