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

/// Read a user-selected project file after the frontend has requested access.
/// Canonicalization prevents a relative path or symlink from escaping the selected root.
#[tauri::command]
pub fn read_codebase_file(root_path: String, relative_path: String) -> Result<String, String> {
    use std::path::{Component, Path, PathBuf};

    let relative = Path::new(&relative_path);
    if relative.is_absolute()
        || relative
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("The requested path must stay inside the selected project folder.".to_string());
    }

    let root = PathBuf::from(root_path)
        .canonicalize()
        .map_err(|error| format!("Could not access the selected project folder: {error}"))?;
    let file = root.join(relative);
    let canonical_file = file
        .canonicalize()
        .map_err(|error| format!("Could not access {relative_path}: {error}"))?;

    if !canonical_file.starts_with(&root) {
        return Err("The requested path is outside the selected project folder.".to_string());
    }

    let bytes = std::fs::read(&canonical_file)
        .map_err(|error| format!("Could not read {relative_path}: {error}"))?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
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
