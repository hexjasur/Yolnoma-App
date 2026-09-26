# Clear what Windows permits and report items held open or protected by permissions.
$paths = @($env:TEMP, "$env:LOCALAPPDATA\Temp", "$env:WINDIR\Temp") | Where-Object { $_ } | Select-Object -Unique
$removed = 0
$skipped = 0
foreach ($path in $paths) {
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
Write-Output "Temporary files: $removed item(s) removed; $skipped skipped (in use or access denied)."
