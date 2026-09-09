use crate::domains::steam::IdlingState;
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

/// Pick a pixel from anywhere on the Windows desktop, including other apps.
/// The command hides Yolnoma while the user selects a point and restores it afterwards.
#[tauri::command]
pub fn pick_screen_color(window: WebviewWindow) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::{thread, time::Duration};
        use windows_sys::Win32::Foundation::POINT;
        use windows_sys::Win32::Graphics::Gdi::{GetDC, GetPixel, ReleaseDC};
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_ESCAPE};
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            CreateWindowExW, DestroyWindow, GetCursorPos, LoadCursorW, SetCursor, SetWindowPos,
            SetWindowTextW, HWND_TOPMOST, IDC_CROSS, SWP_NOACTIVATE, SWP_SHOWWINDOW,
            WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP, WS_VISIBLE,
        };

        fn wide(value: &str) -> Vec<u16> {
            value.encode_utf16().chain(std::iter::once(0)).collect()
        }

        window.hide().map_err(|error| error.to_string())?;
        thread::sleep(Duration::from_millis(180));

        let screen_dc = unsafe { GetDC(std::ptr::null_mut()) };
        if screen_dc.is_null() {
            let _ = window.show();
            return Err("Windows could not access the desktop screen.".to_string());
        }

        let tooltip_class = wide("STATIC");
        let tooltip_text = wide("Pick a pixel\nClick to select • Esc to cancel");
        let tooltip = unsafe {
            CreateWindowExW(
                WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
                tooltip_class.as_ptr(),
                tooltip_text.as_ptr(),
                WS_POPUP | WS_VISIBLE,
                0,
                0,
                250,
                64,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        };
        let previous_cursor = unsafe { SetCursor(LoadCursorW(std::ptr::null_mut(), IDC_CROSS)) };

        while unsafe { (GetAsyncKeyState(0x01) as u16 & 0x8000) != 0 } {
            thread::sleep(Duration::from_millis(16));
        }

        let result = loop {
            if unsafe { (GetAsyncKeyState(VK_ESCAPE as i32) as u16 & 0x8000) != 0 } {
                break Err("Screen color picking cancelled.".to_string());
            }

            let mut point = POINT { x: 0, y: 0 };
            if unsafe { GetCursorPos(&mut point) } == 0 {
                break Err("Windows could not read the cursor position.".to_string());
            }

            if !tooltip.is_null() {
                let pixel = unsafe { GetPixel(screen_dc, point.x, point.y) };
                if pixel != u32::MAX {
                    let red = pixel & 0xff;
                    let green = (pixel >> 8) & 0xff;
                    let blue = (pixel >> 16) & 0xff;
                    let live_text = wide(&format!(
                        "#{red:02X}{green:02X}{blue:02X}\nClick to select • Esc to cancel"
                    ));
                    unsafe {
                        SetWindowTextW(tooltip, live_text.as_ptr());
                        SetWindowPos(
                            tooltip,
                            HWND_TOPMOST,
                            point.x + 18,
                            point.y + 18,
                            250,
                            64,
                            SWP_NOACTIVATE | SWP_SHOWWINDOW,
                        );
                    }
                }
            }

            if unsafe { (GetAsyncKeyState(0x01) as u16 & 0x8000) != 0 } {
                let pixel = unsafe { GetPixel(screen_dc, point.x, point.y) };
                if pixel == u32::MAX {
                    break Err("Windows could not read the selected screen pixel.".to_string());
                }
                let red = pixel & 0xff;
                let green = (pixel >> 8) & 0xff;
                let blue = (pixel >> 16) & 0xff;
                break Ok(format!("#{red:02X}{green:02X}{blue:02X}"));
            }

            thread::sleep(Duration::from_millis(16));
        };

        if !tooltip.is_null() {
            unsafe { DestroyWindow(tooltip) };
        }
        unsafe { SetCursor(previous_cursor) };
        unsafe { ReleaseDC(std::ptr::null_mut(), screen_dc) };
        let _ = window.show();
        let _ = window.set_focus();
        return result;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = window;
        Err("Global screen color picking is currently available on Windows only.".to_string())
    }
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
