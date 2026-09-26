# Remove DirectX's per-user shader cache. Games recreate these files when needed.
$path = Join-Path $env:LOCALAPPDATA 'D3DSCache'
if (Test-Path -LiteralPath $path) {
    Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
