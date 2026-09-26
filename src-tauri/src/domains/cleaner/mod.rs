use serde::Serialize;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::process::Command;

macro_rules! include_script {
    ($name:literal) => {
        include_str!(concat!(
            "../../../../src/features/cleaner/scripts/",
            $name
        ))
    };
}

const CLEAR_WINDOWS_TEMP: &str = include_script!("temp-files.ps1");

const EMPTY_RECYCLE_BIN: &str = include_script!("recycle-bin.ps1");

const CLEAR_DIRECTX_SHADER_CACHE: &str = include_script!("directx-shader-cache.ps1");

const CLEAN_NPM_CACHE: &str = include_script!("npm-cache.ps1");

const CLEAN_PNPM_CACHE: &str = include_script!("pnpm-cache.ps1");

const CLEAN_YARN_CACHE: &str = include_script!("yarn-cache.ps1");

const CLEAN_CARGO_CACHE: &str = include_script!("cargo-cache.ps1");

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanerRunResult {
    pub completed_actions: usize,
    pub message: String,
}

/// Only reviewed task identifiers are accepted; PowerShell source is never supplied by the UI.
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

    if selected.iter().any(|action| script_for_action(action).is_none()) {
        return Err("An unknown cleanup task was requested.".to_string());
    }

    let completed_actions = selected.len();
    tauri::async_runtime
        ::spawn_blocking(move || execute_cleaner(selected)).await
        .map_err(|_| "The cleanup task could not be started.".to_string())?
        .map(|message| CleanerRunResult {
            completed_actions,
            message,
        })
}

fn script_for_action(action: &str) -> Option<&'static str> {
    match action {
        "temp-files" => Some(CLEAR_WINDOWS_TEMP),
        "recycle-bin" => Some(EMPTY_RECYCLE_BIN),
        "directx-shader-cache" => Some(CLEAR_DIRECTX_SHADER_CACHE),
        "npm-cache" => Some(CLEAN_NPM_CACHE),
        "pnpm-cache" => Some(CLEAN_PNPM_CACHE),
        "yarn-cache" => Some(CLEAN_YARN_CACHE),
        "cargo-cache" => Some(CLEAN_CARGO_CACHE),
        _ => None,
    }
}

fn execute_cleaner(selected: Vec<String>) -> Result<String, String> {
    // Per-file cleanup scripts handle expected failures; non-terminating errors
    // and native command stderr must not abort otherwise-successful tasks.
    let mut script = String::from("$ErrorActionPreference = 'Continue'\n\n");
    for action in selected {
        let task_script = script_for_action(&action).ok_or_else(||
            "An unknown cleanup task was requested.".to_string()
        )?;
        script.push_str(task_script);
        script.push('\n');
    }

    let mut command = Command::new("powershell.exe");
    command.args([
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle",
        "Hidden",
        "-Command",
        &script,
    ]);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let output = command
        .output()
        .map_err(|error| format!("PowerShell could not be started on this device: {error}"))?;

    if output.status.success() {
        let detail = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(if detail.is_empty() { "Cleanup completed.".to_string() } else { detail })
    } else {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if detail.is_empty() {
            Err("Windows could not finish the selected cleanup task.".to_string())
        } else {
            Err(format!("Windows could not finish the selected cleanup task: {detail}"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::script_for_action;

    #[test]
    fn every_supported_task_has_a_script() {
        for action in [
            "temp-files",
            "recycle-bin",
            "directx-shader-cache",
            "npm-cache",
            "pnpm-cache",
            "yarn-cache",
            "cargo-cache",
        ] {
            assert!(script_for_action(action).is_some(), "missing {action}");
        }
    }

    #[test]
    fn unsupported_actions_are_rejected() {
        assert!(script_for_action("windows-update-cache").is_none());
        assert!(script_for_action("arbitrary-command").is_none());
    }
}
