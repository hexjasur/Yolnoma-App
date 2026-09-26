# Remove downloaded Cargo registry and Git dependency caches, not your Cargo configuration.
$paths = @(
    (Join-Path $env:USERPROFILE '.cargo\registry\cache'),
    (Join-Path $env:USERPROFILE '.cargo\registry\src'),
    (Join-Path $env:USERPROFILE '.cargo\git\db'),
    (Join-Path $env:USERPROFILE '.cargo\git\checkouts')
)
foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) {
        Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
}
