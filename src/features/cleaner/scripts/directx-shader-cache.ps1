# Remove what Windows permits; running games may keep some shader files locked.
$path = Join-Path $env:LOCALAPPDATA 'D3DSCache'
$removed = 0
$skipped = 0
try {
    if (Test-Path -LiteralPath $path -PathType Container -ErrorAction Stop) {
        $items = @(Get-ChildItem -LiteralPath $path -Force -ErrorAction Stop)
        foreach ($item in $items) {
            try {
                Remove-Item -LiteralPath $item.FullName -Force -Recurse -ErrorAction Stop
                $removed++
            } catch {
                $skipped++
            }
        }
    }
} catch {
    $skipped++
}
Write-Output "DirectX shader cache: $removed item(s) removed; $skipped skipped (in use or access denied)."
