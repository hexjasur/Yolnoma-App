//! Safe update preparation for the desktop updater.
//!
//! This deliberately clears only volatile SteamUtility/idling runtime state. It never
//! touches Yolnoma authentication tokens, account config, encrypted API keys, or user
//! session records, so an update can relaunch without forcing a new login.

use serde::Serialize;
use sysinfo::System;
use tauri::State;

use crate::app_commands;
use crate::domains::steam::IdlingState;

const STEAM_UTILITY_PROCESS: &str = "steamutility";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePreparation {
    /// Number of tracked idling games drained from Yolnoma's volatile process registry.
    pub stopped_idling_games: usize,
    /// Number of SteamUtility processes terminated as a final process-name backstop.
    pub killed_steam_utility_processes: usize,
}

/// Stop volatile Steam runtime state before Tauri installs an update.
///
/// The process registry is the only active-session state Yolnoma owns locally. It is
/// intentionally drained, while auth/session storage remains untouched. The process-name
/// pass catches a helper that exited its child tracking path or was started by an older build.
#[tauri::command]
pub async fn prepare_for_update(
    state: State<'_, IdlingState>,
) -> Result<UpdatePreparation, String> {
    let stopped_idling_games = {
        let processes = state.processes.lock().await;
        processes.len()
    };

    app_commands::stop_idling_processes(&state).await;
    let killed_steam_utility_processes = kill_steam_utility_processes();

    Ok(UpdatePreparation {
        stopped_idling_games,
        killed_steam_utility_processes,
    })
}

fn kill_steam_utility_processes() -> usize {
    let mut system = System::new_all();
    system.refresh_all();

    system
        .processes()
        .values()
        .filter(|process| is_steam_utility_name(process.name()) && process.kill())
        .count()
}

fn is_steam_utility_name(name: &str) -> bool {
    let normalized = name.to_ascii_lowercase();
    normalized == STEAM_UTILITY_PROCESS || normalized == format!("{STEAM_UTILITY_PROCESS}.exe")
}

#[cfg(test)]
mod tests {
    use super::is_steam_utility_name;

    #[test]
    fn recognizes_windows_and_linux_helper_names() {
        assert!(is_steam_utility_name("SteamUtility.exe"));
        assert!(is_steam_utility_name("SteamUtility"));
        assert!(!is_steam_utility_name("steam.exe"));
    }
}
