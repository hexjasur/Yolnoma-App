use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

mod commands;
mod db;
mod embedded_api_key;
mod models;
mod steam_idler;
mod system_monitor;

pub struct AuthState {
    pub user_id: Mutex<Option<String>>,
}

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

/// Barcha idlingni to'xtatib dasturdan chiqish
#[tauri::command]
async fn exit_app(
    state: tauri::State<'_, steam_idler::IdlingState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // Barcha idling jarayonlarini to'xtatamiz
    let mut processes = state.processes.lock().await;
    for (_, mut h) in processes.drain() {
        let _ = h.child.kill().await;
    }
    drop(processes);
    // Dasturdan chiqamiz
    app.exit(0);
    Ok(())
}

/// Oynani yashirish (minimize to tray)
#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

/// Idling holatini tekshirish (tray tooltip uchun)
#[tauri::command]
async fn get_idling_count(
    state: tauri::State<'_, steam_idler::IdlingState>,
) -> Result<usize, String> {
    let processes = state.processes.lock().await;
    Ok(processes.len())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AuthState {
            user_id: Mutex::new(None),
        })
        .manage(steam_idler::IdlingState::new())
        .manage(system_monitor::SystemMonitorState::new())
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
                        if let Some((_, code)) = parsed_url.query_pairs().find(|(k, _)| k == "code") {
                            let _ = app.emit("auth-code-received", code.to_string());
                        }
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
                        if let Some((_, code)) = parsed_url.query_pairs().find(|(k, _)| k == "code") {
                            let _ = handle.emit("auth-code-received", code.to_string());
                        }
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
            // X tugmasi bosilganda oynani avtomatik trayga yashiramiz (faqat tray menu 'Exit' dan to'liq chiqadi)
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            exit_app,
            hide_window,
            get_idling_count,
            commands::proxy_request,
            commands::add_performance,
            commands::list_performances,
            commands::get_performance,
            commands::update_performance,
            commands::delete_performance,
            commands::proxy_eporner,
            commands::save_video,
            commands::unsave_video,
            commands::get_video_save_status,
            commands::list_saved_videos,
            // ── Plugins System ──
            commands::list_local_plugins,
            commands::read_plugin_source,
            // ── System Monitoring ──
            system_monitor::get_system_stats,
            // ── Steam Idler ──
            steam_idler::steam_is_running,
            steam_idler::get_steam_accounts,
            steam_idler::get_steam_games,
            steam_idler::start_idling,
            steam_idler::stop_idling,
            steam_idler::stop_all_idling,
            steam_idler::get_idle_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
