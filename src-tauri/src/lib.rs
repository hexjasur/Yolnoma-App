use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

mod commands;
#[path = "commands/videos.rs"]
mod videos;
mod cleaner;
mod embedded_api_key;
mod steam_idler;
mod system_monitor;

pub struct AuthState {
    pub user_id: Mutex<Option<String>>,
}

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

/// Stop all idle processes and exit the program.
#[tauri::command]
async fn exit_app(
    state: tauri::State<'_, steam_idler::IdlingState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // Stop all idling processes
    let mut processes = state.processes.lock().await;
    for (_, mut h) in processes.drain() {
        let _ = h.child.kill().await;
    }
    drop(processes);
    // Exiting the program
    app.exit(0);
    Ok(())
}

/// Hide window (minimize to tray)
#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

/// Check idle state (for tray tooltip)
#[tauri::command]
async fn get_idling_count(
    state: tauri::State<'_, steam_idler::IdlingState>,
) -> Result<usize, String> {
    let processes = state.processes.lock().await;
    Ok(processes.len())
}

/// Dispatch a parsed `yolnoma://` URL to the appropriate Tauri event.
///
/// | URL host        | Emitted event          | Payload             |
/// |-----------------|------------------------|---------------------|
/// | `auth`          | `auth-code-received`   | one-time code       |
/// | `session-limit` | `session-limit-reached`| temp_code           |
fn handle_yolnoma_url(app: &tauri::AppHandle, url: &url::Url) {
    match url.host_str().unwrap_or("") {
        "auth" => {
            if let Some((_, code)) = url.query_pairs().find(|(k, _)| k == "code") {
                let _ = app.emit("auth-code-received", code.to_string());
            }
        }
        "session-limit" => {
            if let Some((_, temp_code)) = url.query_pairs().find(|(k, _)| k == "temp_code") {
                let _ = app.emit("session-limit-reached", temp_code.to_string());
            }
        }
        _ => {}
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AuthState {
            user_id: Mutex::new(None),
        })
        .manage(steam_idler::IdlingState::new())
        .manage(system_monitor::SystemMonitorState::new())
            .manage(videos::DownloadState::new())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            for arg in args {
                if arg.starts_with("yolnoma://") {
                    if let Ok(parsed_url) = url::Url::parse(&arg) {
                        handle_yolnoma_url(app, &parsed_url);
                    }
                }
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // Register deep link scheme in Windows Registry (HKCU\Software\Classes\yolnoma)
            #[cfg(any(windows, target_os = "linux"))]
            {
                let _ = app.deep_link().register_all();
            }

            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for parsed_url in event.urls() {
                    if parsed_url.scheme() == "yolnoma" {
                        handle_yolnoma_url(&handle, &parsed_url);
                    }
                }
            });
            use tauri::{
                menu::{MenuBuilder, MenuItemBuilder},
                tray::{TrayIconBuilder, TrayIconEvent},
                Manager,
            };

            // Tray menyu
            let show = MenuItemBuilder::new("Show")
                .id("show")
                .build(app)?;
            let quit = MenuItemBuilder::new("Exit")
                .id("quit")
                .build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show)
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Yolnoma")
                .menu(&menu)
                .show_menu_on_left_click(false) // Left click opens window, right click opens menu
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        // Barcha idling jarayonlarini to'xtatamiz, keyin chiqamiz
                        let state = app.state::<steam_idler::IdlingState>();
                        tauri::async_runtime::block_on(async {
                            let mut processes = state.processes.lock().await;
                            for (_, mut h) in processes.drain() {
                                let _ = h.child.kill().await;
                            }
                        });
                        // 500ms kutib, Steam trigger bo'lsin
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // The main window is hidden to the tray when 'X' is clicked, while secondary (tab/popup) windows are fully closed.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            exit_app,
            hide_window,
            get_idling_count,
            commands::proxy_request,
            commands::proxy_eporner,
            commands::open_in_new_window,
            // ── YouTube Video Downloader ──
            videos::download_youtube_video,
            videos::cancel_youtube_download,
            videos::open_youtube_download_folder,
            videos::get_youtube_formats,
            videos::preview_youtube_video,
            videos::check_yt_dlp_installed,
            videos::check_ffmpeg_installed,
            // ── Plugins System ──
            commands::list_local_plugins,
            commands::read_plugin_source,
            // ── System Monitoring ──
            system_monitor::get_system_stats,
            // ── Cleaner ──
            cleaner::run_cleaner,
            // ── Steam Idler & SAM ──
            steam_idler::steam_is_running,
            steam_idler::get_steam_accounts,
            steam_idler::get_steam_games,
            steam_idler::start_idling,
            steam_idler::stop_idling,
            steam_idler::stop_all_idling,
            steam_idler::get_idle_state,
            steam_idler::get_achievement_data,
            steam_idler::set_achievement,
            steam_idler::unlock_all_achievements,
            steam_idler::lock_all_achievements,
            steam_idler::update_stats,
            steam_idler::reset_all_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
