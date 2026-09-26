# Clear Bun's downloaded package cache directly; Bun recreates it when needed.
$path = Join-Path $env:USERPROFILE '.bun\install\cache'
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
Write-Output "Bun cache: $removed item(s) removed; $skipped skipped (in use or access denied)."
