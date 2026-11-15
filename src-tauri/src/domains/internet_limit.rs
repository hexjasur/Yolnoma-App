use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::Path;
use sysinfo::System;

/// Windows QoS policies are named with this prefix so the app only ever
/// lists or removes policies it created itself.
const POLICY_PREFIX: &str = "Yolnoma-";
const MIN_LIMIT_KBPS: u64 = 1;
const MAX_LIMIT_KBPS: u64 = 10_000_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkApp {
    pub name: String,
    pub exe_path: String,
    pub process_count: u32,
    pub memory_bytes: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BandwidthLimit {
    pub policy_name: String,
    pub exe_path: String,
    pub limit_kbps: u64,
}

/// FNV-1a is used instead of `DefaultHasher` because the policy name must
/// stay identical across app versions, otherwise old limits can't be found.
fn stable_hash(value: &str) -> u32 {
    let mut hash: u32 = 0x811c_9dc5;
    for byte in value.to_lowercase().bytes() {
        hash ^= u32::from(byte);
        hash = hash.wrapping_mul(0x0100_0193);
    }
    hash
}

fn policy_name_for(exe_path: &str) -> String {
    let file_name = Path::new(exe_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("app");
    let sanitized: String = file_name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '_'
            }
        })
        .collect();
    format!("{POLICY_PREFIX}{sanitized}-{:08x}", stable_hash(exe_path))
}

fn validate_exe_path(path: &str) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() || trimmed.len() > 260 || trimmed.chars().any(char::is_control) {
        return Err("Invalid application path.".to_string());
    }
    if !trimmed.to_lowercase().ends_with(".exe") {
        return Err("Only .exe applications can be limited.".to_string());
    }
    if !Path::new(trimmed).is_file() {
        return Err("The application file could not be found.".to_string());
    }
    Ok(trimmed.to_string())
}

fn validate_policy_name(name: &str) -> Result<(), String> {
    let has_yolnoma_prefix = name
        .get(..POLICY_PREFIX.len())
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case(POLICY_PREFIX));
    let valid = has_yolnoma_prefix
        && name.len() <= 200
        && name.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        });
    if valid {
        Ok(())
    } else {
        Err("Invalid bandwidth policy name.".to_string())
    }
}

/// Single quotes are doubled so a path such as `C:\Tom's\app.exe` can't break
/// out of the PowerShell string literal.
fn ps_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(windows)]
fn run_powershell(script: &str) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let output = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| format!("PowerShell could not be started: {error}"))?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(format!("Bandwidth policy command failed: {stderr}"))
}

#[cfg(windows)]
fn is_elevated() -> bool {
    run_powershell(
        "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent())\
         .IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)",
    )
    .map(|output| output.trim().eq_ignore_ascii_case("true"))
    .unwrap_or(false)
}

/// Runs the script in a separate elevated PowerShell. Windows shows its own
/// UAC consent prompt, so Yolnoma never has to run as administrator itself.
/// The script goes through -EncodedCommand instead of a temp file, so nothing
/// can be swapped in between writing it and the elevated process running it.
///
/// Exit codes from the launcher: 9 = prompt declined or launch failed,
/// 1 = the script itself failed while elevated.
#[cfg(windows)]
fn run_elevated(script: &str) -> Result<(), String> {
    use base64::Engine;
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let wrapped = format!("try {{ {script}; exit 0 }} catch {{ exit 1 }}");
    let utf16: Vec<u8> = wrapped
        .encode_utf16()
        .flat_map(|unit| unit.to_le_bytes())
        .collect();
    let encoded = base64::engine::general_purpose::STANDARD.encode(utf16);

    let launcher = format!(
        "try {{ $p = Start-Process -FilePath 'powershell.exe' \
         -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand','{encoded}') \
         -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode }} catch {{ exit 9 }}"
    );

    let status = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            launcher.as_str(),
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|error| format!("PowerShell could not be started: {error}"))?;

    match status.code() {
        Some(0) => Ok(()),
        Some(9) => Err("Administrator permission was not granted. Accept the Windows prompt to change bandwidth limits.".to_string()),
        Some(1) => Err("The bandwidth change failed while running with administrator rights.".to_string()),
        other => Err(format!("Bandwidth change ended unexpectedly (exit code {other:?}).")),
    }
}

/// Uses the current rights when Yolnoma is already elevated, otherwise asks
/// Windows for elevation only for this single change.
#[cfg(windows)]
fn run_privileged(script: &str) -> Result<(), String> {
    if is_elevated() {
        run_powershell(script).map(|_| ())
    } else {
        run_elevated(script)
    }
}

#[cfg(not(windows))]
fn run_powershell(_script: &str) -> Result<String, String> {
    Err("Bandwidth limits are available only on Windows.".to_string())
}

#[cfg(not(windows))]
fn run_privileged(_script: &str) -> Result<(), String> {
    Err("Bandwidth limits are available only on Windows.".to_string())
}

fn collect_network_apps() -> Vec<NetworkApp> {
    let own_exe = std::env::current_exe()
        .ok()
        .map(|path| path.to_string_lossy().to_lowercase());

    let system = System::new_all();
    let mut grouped: BTreeMap<String, NetworkApp> = BTreeMap::new();

    for process in system.processes().values() {
        let Some(exe) = process.exe() else { continue };
        let exe_path = exe.to_string_lossy().into_owned();
        let key = exe_path.to_lowercase();

        if !key.ends_with(".exe") || key.contains("\\windows\\") || Some(&key) == own_exe.as_ref() {
            continue;
        }

        let entry = grouped.entry(key).or_insert_with(|| NetworkApp {
            name: exe
                .file_stem()
                .map(|stem| stem.to_string_lossy().into_owned())
                .unwrap_or_else(|| exe_path.clone()),
            exe_path: exe_path.clone(),
            process_count: 0,
            memory_bytes: 0,
        });
        entry.process_count += 1;
        entry.memory_bytes += process.memory();
    }

    let mut apps: Vec<NetworkApp> = grouped.into_values().collect();
    apps.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    apps
}

#[tauri::command]
pub async fn list_network_apps() -> Result<Vec<NetworkApp>, String> {
    tokio::task::spawn_blocking(collect_network_apps)
        .await
        .map_err(|error| format!("Process scan failed: {error}"))
}

#[tauri::command]
pub async fn list_bandwidth_limits() -> Result<Vec<BandwidthLimit>, String> {
    let script =
        "Get-NetQosPolicy -PolicyStore ActiveStore | Where-Object { $_.Name -like 'Yolnoma-*' } | \
                  Select-Object Name, AppPathNameMatchCondition, ThrottleRateActionBitsPerSecond | \
                  ConvertTo-Json -Compress";

    let output = tokio::task::spawn_blocking(move || run_powershell(script))
        .await
        .map_err(|error| format!("Policy query failed: {error}"))??;

    let trimmed = output.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let parsed: Value = serde_json::from_str(trimmed)
        .map_err(|error| format!("Policy list could not be parsed: {error}"))?;
    let items = match parsed {
        Value::Array(items) => items,
        single => vec![single],
    };

    Ok(items
        .iter()
        .filter_map(|item| {
            let policy_name = item.get("Name")?.as_str()?.to_string();
            let exe_path = item.get("AppPathNameMatchCondition")?.as_str()?.to_string();
            let bits_per_second = item.get("ThrottleRateActionBitsPerSecond")?.as_u64()?;
            Some(BandwidthLimit {
                policy_name,
                exe_path,
                limit_kbps: bits_per_second / 8 / 1024,
            })
        })
        .collect())
}

#[tauri::command]
pub async fn set_app_bandwidth_limit(
    exe_path: String,
    limit_kbps: u64,
) -> Result<BandwidthLimit, String> {
    if !(MIN_LIMIT_KBPS..=MAX_LIMIT_KBPS).contains(&limit_kbps) {
        return Err(format!(
            "Limit must be between {MIN_LIMIT_KBPS} and {MAX_LIMIT_KBPS} KB/s."
        ));
    }

    let path = validate_exe_path(&exe_path)?;
    let policy_name = policy_name_for(&path);
    let bits_per_second = limit_kbps * 8 * 1024;

    // Remove first so re-applying a limit replaces the old value instead of failing.
    let script = format!(
        "$ErrorActionPreference = 'Stop'; \
         if (Get-NetQosPolicy -PolicyStore ActiveStore -Name {name} -ErrorAction SilentlyContinue) {{ \
         Remove-NetQosPolicy -PolicyStore ActiveStore -Name {name} -Confirm:$false }}; \
         New-NetQosPolicy -Name {name} -AppPathNameMatchCondition {path} \
         -ThrottleRateActionBitsPerSecond {bps} -PolicyStore ActiveStore | Out-Null",
        name = ps_quote(&policy_name),
        path = ps_quote(&path),
        bps = bits_per_second,
    );

    tokio::task::spawn_blocking(move || run_privileged(&script))
        .await
        .map_err(|error| format!("Policy update failed: {error}"))??;

    Ok(BandwidthLimit {
        policy_name,
        exe_path: path,
        limit_kbps,
    })
}

#[tauri::command]
pub async fn remove_app_bandwidth_limit(policy_name: String) -> Result<(), String> {
    validate_policy_name(&policy_name)?;

    let script = format!(
        "$ErrorActionPreference = 'Stop'; Remove-NetQosPolicy -PolicyStore ActiveStore -Name {} -Confirm:$false",
        ps_quote(&policy_name)
    );

    tokio::task::spawn_blocking(move || run_privileged(&script))
        .await
        .map_err(|error| format!("Policy removal failed: {error}"))??;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate_policy_name;

    #[test]
    fn accepts_policy_names_returned_by_windows_case_insensitively() {
        assert!(validate_policy_name("yolnoma-ayugram.exe-85eb1bd4").is_ok());
        assert!(validate_policy_name("Yolnoma-ayugram.exe-85eb1bd4").is_ok());
        assert!(validate_policy_name("Other-app").is_err());
    }
}
