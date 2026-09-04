use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

pub const CROSSHAIR_WINDOW_LABEL: &str = "crosshair-overlay-window";
static TOPMOST_LOOP_RUNNING: AtomicBool = AtomicBool::new(false);

/// Helper to get path to crosshair config file in AppData
fn get_config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_local_data_dir()
        .ok()
        .map(|dir| dir.join("crosshair_config.json"))
}

/// Save crosshair config to disk for permanent persistence
#[tauri::command]
pub async fn save_crosshair_config(
    app: AppHandle,
    config: serde_json::Value,
) -> Result<(), String> {
    if let Some(path) = get_config_path(&app) {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(&path, config.to_string());
    }
    // Also emit update to any open overlay
    let _ = app.emit("crosshair-config-changed", config);
    Ok(())
}

/// Load saved crosshair config from disk
#[tauri::command]
pub async fn get_saved_crosshair_config(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    if let Some(path) = get_config_path(&app) {
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                    return Ok(Some(val));
                }
            }
        }
    }
    Ok(None)
}

/// Apply bulletproof Win32 Topmost & Click-Through styles to the HWND
#[cfg(windows)]
fn enforce_win32_topmost(win: &tauri::WebviewWindow) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, HWND_TOPMOST,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
        WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT,
    };

    if let Ok(hwnd) = win.hwnd() {
        let hwnd_val = hwnd.0 as windows_sys::Win32::Foundation::HWND;
        unsafe {
            let ex_style = GetWindowLongPtrW(hwnd_val, GWL_EXSTYLE);
            let target_style = (WS_EX_TOPMOST
                | WS_EX_LAYERED
                | WS_EX_TRANSPARENT
                | WS_EX_TOOLWINDOW
                | WS_EX_NOACTIVATE) as isize;

            if (ex_style & target_style) != target_style {
                SetWindowLongPtrW(hwnd_val, GWL_EXSTYLE, ex_style | target_style);
            }

            SetWindowPos(
                hwnd_val,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
        }
    }
}

#[cfg(not(windows))]
fn enforce_win32_topmost(_win: &tauri::WebviewWindow) {}

/// Start a lightweight background thread to keep the overlay strictly on top
fn start_topmost_keepalive(app: AppHandle) {
    if TOPMOST_LOOP_RUNNING.swap(true, Ordering::SeqCst) {
        return; // Already running
    }

    let running_flag = Arc::new(AtomicBool::new(true));
    let flag_clone = running_flag.clone();

    tauri::async_runtime::spawn(async move {
        while flag_clone.load(Ordering::Relaxed) {
            tokio::time::sleep(Duration::from_millis(500)).await;

            if let Some(win) = app.get_webview_window(CROSSHAIR_WINDOW_LABEL) {
                if win.is_visible().unwrap_or(false) {
                    #[cfg(windows)]
                    enforce_win32_topmost(&win);
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        TOPMOST_LOOP_RUNNING.store(false, Ordering::SeqCst);
    });
}

#[tauri::command]
pub async fn start_crosshair_overlay(
    app: AppHandle,
    config: Option<serde_json::Value>,
) -> Result<(), String> {
    // 1. Save config to disk if provided
    if let Some(ref cfg) = config {
        let _ = save_crosshair_config(app.clone(), cfg.clone()).await;
    }

    // 2. If window already exists, show it and enforce styles
    if let Some(win) = app.get_webview_window(CROSSHAIR_WINDOW_LABEL) {
        let _ = win.show();
        let _ = win.set_always_on_top(true);
        let _ = win.set_ignore_cursor_events(true);

        #[cfg(windows)]
        enforce_win32_topmost(&win);

        start_topmost_keepalive(app.clone());

        if let Some(cfg) = config {
            let _ = app.emit("crosshair-config-changed", cfg);
        }
        return Ok(());
    }

    // 3. Determine webview URL
    let webview_url = if let Some(main_win) = app.get_webview_window("main") {
        if let Ok(main_url) = main_win.url() {
            let mut target_url = main_url.clone();
            target_url.set_fragment(Some("/crosshair-overlay-window"));
            WebviewUrl::External(target_url)
        } else {
            WebviewUrl::App("index.html#/crosshair-overlay-window".into())
        }
    } else {
        WebviewUrl::App("index.html#/crosshair-overlay-window".into())
    };

    // 4. Build window
    let builder = WebviewWindowBuilder::new(&app, CROSSHAIR_WINDOW_LABEL, webview_url)
        .title("Crosshair Overlay")
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .shadow(false)
        .skip_taskbar(true)
        .resizable(false)
        .inner_size(300.0, 300.0)
        .center();

    let win = builder
        .build()
        .map_err(|e| format!("Failed to create crosshair window: {}", e))?;

    let _ = win.set_always_on_top(true);
    let _ = win.set_ignore_cursor_events(true);

    #[cfg(windows)]
    enforce_win32_topmost(&win);

    start_topmost_keepalive(app.clone());

    if let Some(cfg) = config {
        let _ = app.emit("crosshair-config-changed", cfg);
    }

    Ok(())
}

#[tauri::command]
pub async fn stop_crosshair_overlay(app: AppHandle) -> Result<(), String> {
    TOPMOST_LOOP_RUNNING.store(false, Ordering::SeqCst);
    if let Some(win) = app.get_webview_window(CROSSHAIR_WINDOW_LABEL) {
        let _ = win.close();
    }
    Ok(())
}

#[tauri::command]
pub async fn update_crosshair_config(
    app: AppHandle,
    config: serde_json::Value,
) -> Result<(), String> {
    let _ = save_crosshair_config(app.clone(), config.clone()).await;
    app.emit("crosshair-config-changed", config)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn is_crosshair_active(app: AppHandle) -> Result<bool, String> {
    if let Some(win) = app.get_webview_window(CROSSHAIR_WINDOW_LABEL) {
        Ok(win.is_visible().unwrap_or(false))
    } else {
        Ok(false)
    }
}
