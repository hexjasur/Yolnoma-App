# Clear only the AMD shader-cache folders shown in the selected user's LocalAppData.
# The graphics driver and games recreate these caches; busy or protected items are skipped.
$root = Join-Path $env:LOCALAPPDATA 'AMD'
$cacheNames = @('DxCache', 'DxcCache', 'OglCache', 'VkCache')
$removed = 0
$skipped = 0
foreach ($name in $cacheNames) {
    $path = Join-Path $root $name
    try {
        if (-not (Test-Path -LiteralPath $path -PathType Container -ErrorAction Stop)) { continue }
        $items = @(Get-ChildItem -LiteralPath $path -Force -ErrorAction Stop)
    } catch {
        $skipped++
        continue
    }
    foreach ($item in $items) {
        try {
            Remove-Item -LiteralPath $item.FullName -Force -Recurse -ErrorAction Stop
            $removed++
        } catch {
            $skipped++
        }
    }
}
Write-Output "AMD graphics cache: $removed item(s) removed; $skipped skipped (in use or access denied)."
