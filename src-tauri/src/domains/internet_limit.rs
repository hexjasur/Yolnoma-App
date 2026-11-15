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
#[cfg(windows)]
const ADMIN_HINT: &str = "Administrator rights are required to change bandwidth limits. Restart Yolnoma as administrator and try again.";

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
    let valid = name.starts_with(POLICY_PREFIX)
        && name.len() <= 200
        && name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'));
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
    let lowered = stderr.to_lowercase();
    if lowered.contains("access is denied")
        || lowered.contains("administrator")
        || lowered.contains("unauthorized")
    {
        return Err(ADMIN_HINT.to_string());
    }
    Err(format!("Bandwidth policy command failed: {stderr}"))
}

#[cfg(not(windows))]
fn run_powershell(_script: &str) -> Result<String, String> {
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
    let script = "Get-NetQosPolicy | Where-Object { $_.Name -like 'Yolnoma-*' } | \
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
            let bits_per_second = item
                .get("ThrottleRateActionBitsPerSecond")?
                .as_u64()?;
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
         Get-NetQosPolicy -Name {name} -ErrorAction SilentlyContinue | Remove-NetQosPolicy -Confirm:$false; \
         New-NetQosPolicy -Name {name} -AppPathNameMatchCondition {path} \
         -ThrottleRateActionBitsPerSecond {bps} -PolicyStore ActiveStore | Out-Null",
        name = ps_quote(&policy_name),
        path = ps_quote(&path),
        bps = bits_per_second,
    );

    tokio::task::spawn_blocking(move || run_powershell(&script))
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
        "$ErrorActionPreference = 'Stop'; Remove-NetQosPolicy -Name {} -Confirm:$false",
        ps_quote(&policy_name)
    );

    tokio::task::spawn_blocking(move || run_powershell(&script))
        .await
        .map_err(|error| format!("Policy removal failed: {error}"))??;
    Ok(())
}
