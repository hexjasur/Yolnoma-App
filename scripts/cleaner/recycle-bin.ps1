# Only check fixed local drives; unavailable or mapped drives are not touched.
$drives = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType = 3" |
    ForEach-Object { $_.DeviceID.TrimEnd(':') }
$failures = @()
foreach ($drive in $drives) {
    try {
        Clear-RecycleBin -DriveLetter $drive -Force -ErrorAction Stop
    } catch {
        # Windows creates a Recycle Bin folder only after a drive needs one.
        if ($_.Exception.Message -notmatch 'cannot find the path|system cannot find the path') {
            $failures += "${drive}: $($_.Exception.Message)"
        }
    }
}
if ($failures.Count -gt 0) {
    throw "Could not clear the Recycle Bin on: $($failures -join '; ')"
}
