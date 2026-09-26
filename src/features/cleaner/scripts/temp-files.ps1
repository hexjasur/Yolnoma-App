# Remove temporary files from the current user and Windows Temp folders.
$paths = @($env:TEMP, "$env:LOCALAPPDATA\Temp", "$env:WINDIR\Temp") | Where-Object { $_ } | Select-Object -Unique
foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) {
        Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
}
