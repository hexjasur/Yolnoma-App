use crate::steam_idler::IdlingState;
use tauri::{AppHandle, State, WebviewWindow};

#[tauri::command]
pub fn ping() -> String {
    "pong".to_string()
}

/// Stop active Steam idling processes before shutting down the application.
#[tauri::command]
pub async fn exit_app(state: State<'_, IdlingState>, app: AppHandle) -> Result<(), String> {
    stop_idling_processes(&state).await;
    app.exit(0);
    Ok(())
}

/// Hide the main window so the tray process can continue running.
#[tauri::command]
pub fn hide_window(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|error| error.to_string())
}

/// Return the number of currently active idling processes for the tray UI.
#[tauri::command]
pub async fn get_idling_count(state: State<'_, IdlingState>) -> Result<usize, String> {
    let processes = state.processes.lock().await;
    Ok(processes.len())
}

pub async fn stop_idling_processes(state: &IdlingState) {
    let mut processes = state.processes.lock().await;
    for (_, mut handle) in processes.drain() {
        let _ = handle.child.kill().await;
    }
}
