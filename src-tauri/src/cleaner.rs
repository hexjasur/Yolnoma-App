use serde::Serialize;
use std::process::Command;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CLEAR_WINDOWS_TEMP: &str = r#"
# Remove temporary files from the current user and Windows Temp folders.
$paths = @($env:TEMP, "$env:LOCALAPPDATA\Temp", "$env:WINDIR\Temp") | Select-Object -Unique
foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) {
        Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
}
"#;

const CLEAR_WINDOWS_UPDATE_CACHE: &str = r#"
# Pause Windows Update, clear its downloaded packages, then restore its prior state.
$updateService = Get-Service -Name 'wuauserv' -ErrorAction Stop
$wasRunning = $updateService.Status -eq 'Running'
if ($wasRunning) { Stop-Service -Name 'wuauserv' -Force -ErrorAction Stop }
try {
    $path = Join-Path $env:WINDIR 'SoftwareDistribution\Download'
    if (Test-Path -LiteralPath $path) {
        Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
} finally {
    if ($wasRunning) { Start-Service -Name 'wuauserv' -ErrorAction Stop }
}
"#;

const CLEAR_DIRECTX_SHADER_CACHE: &str = r#"
# Remove DirectX's per-user shader cache. Games recreate these files when needed.
$path = Join-Path $env:LOCALAPPDATA 'D3DSCache'
if (Test-Path -LiteralPath $path) {
    Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
"#;

const CLEAN_NPM_CACHE: &str = r#"
# Run only when npm is installed. The --force flag is required by npm for cache cleanup.
if ($null -eq (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Output 'npm is not installed; cache cleanup skipped.'
} else {
    npm cache clean --force
    if ($LASTEXITCODE -ne 0) { throw 'npm cache cleanup failed.' }
}
"#;

const CLEAN_PNPM_CACHE: &str = r#"
# Prune unreferenced packages from pnpm's shared content-addressable store.
if ($null -eq (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Output 'pnpm is not installed; cache cleanup skipped.'
} else {
    pnpm store prune
    if ($LASTEXITCODE -ne 0) { throw 'pnpm cache cleanup failed.' }
}
"#;

const CLEAN_YARN_CACHE: &str = r#"
# Clear Yarn's cache when Yarn is available on this device.
if ($null -eq (Get-Command yarn -ErrorAction SilentlyContinue)) {
    Write-Output 'Yarn is not installed; cache cleanup skipped.'
} else {
    yarn cache clean
    if ($LASTEXITCODE -ne 0) { throw 'Yarn cache cleanup failed.' }
}
"#;

const CLEAN_CARGO_CACHE: &str = r#"
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
"#;

const ADMIN_PREFLIGHT: &str = r#"
# Stopping/starting the Windows Update service requires administrator rights.
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator privileges are required to clear the Windows Update cache.'
}
"#;

const EMPTY_RECYCLE_BIN: &str = r#"
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
"#;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanerRunResult {
    pub completed_actions: usize,
    pub message: String,
}

/// Runs a small, allow-listed set of cleanup tasks. The frontend never sends a
/// command to execute: it only selects from these known identifiers.
#[tauri::command]
pub async fn run_cleaner(actions: Vec<String>) -> Result<CleanerRunResult, String> {
    let mut selected = Vec::new();
    for action in actions {
        if !selected.contains(&action) {
            selected.push(action);
        }
    }

    if selected.is_empty() {
        return Err("Select at least one cleanup task.".to_string());
    }

    if selected.iter().any(|action| {
        !matches!(
            action.as_str(),
            "temp-files"
                | "recycle-bin"
                | "windows-update-cache"
                | "directx-shader-cache"
                | "npm-cache"
                | "pnpm-cache"
                | "yarn-cache"
                | "cargo-cache"
        )
    }) {
        return Err("An unknown cleanup task was requested.".to_string());
    }

    let completed_actions = selected.len();
    tauri::async_runtime::spawn_blocking(move || execute_cleaner(selected))
        .await
        .map_err(|_| "The cleanup task could not be started.".to_string())?
        .map(|message| CleanerRunResult {
            completed_actions,
            message,
        })
}

fn execute_cleaner(selected: Vec<String>) -> Result<String, String> {
    let mut script = String::from(
        "# Yolnoma Cleaner - generated from reviewed, allow-listed tasks.\n$ErrorActionPreference = 'Continue'\n\n",
    );

    if selected
        .iter()
        .any(|action| action == "windows-update-cache")
    {
        script.push_str(ADMIN_PREFLIGHT);
        script.push('\n');
    }

    for action in selected {
        match action.as_str() {
            "temp-files" => script.push_str(CLEAR_WINDOWS_TEMP),
            "recycle-bin" => script.push_str(EMPTY_RECYCLE_BIN),
            "windows-update-cache" => script.push_str(CLEAR_WINDOWS_UPDATE_CACHE),
            "directx-shader-cache" => script.push_str(CLEAR_DIRECTX_SHADER_CACHE),
            "npm-cache" => script.push_str(CLEAN_NPM_CACHE),
            "pnpm-cache" => script.push_str(CLEAN_PNPM_CACHE),
            "yarn-cache" => script.push_str(CLEAN_YARN_CACHE),
            "cargo-cache" => script.push_str(CLEAN_CARGO_CACHE),
            _ => unreachable!("actions are validated before execution"),
        }
        script.push('\n');
    }

    let output = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &script,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|_| "PowerShell could not be started on this device.".to_string())?;

    if output.status.success() {
        Ok("Cleanup completed quietly in the background.".to_string())
    } else {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if detail.is_empty() {
            Err("Windows could not finish the selected cleanup tasks.".to_string())
        } else {
            Err(format!(
                "Windows could not finish the selected cleanup tasks: {detail}"
            ))
        }
    }
}
