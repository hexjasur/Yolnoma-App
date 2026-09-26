# Remove npm's default Windows cache directly, without invoking npm.ps1 or npm.cmd.
$path = Join-Path $env:LOCALAPPDATA 'npm-cache'
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
Write-Output "npm cache: $removed item(s) removed; $skipped skipped (in use or access denied)."
