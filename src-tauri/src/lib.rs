#[cfg(not(target_os = "android"))]
use tauri::Manager;
#[cfg(not(target_os = "android"))]
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg(not(target_os = "android"))]
mod app_commands;
mod app_state;
#[cfg(not(target_os = "android"))]
mod commands;
#[cfg(not(target_os = "android"))]
mod deep_link;
#[cfg(not(target_os = "android"))]
mod domains;
#[cfg(target_os = "android")]
mod mobile_backend;
#[cfg(not(target_os = "android"))]
mod embedded_api_key;

// Kept public for feature modules that use the shared authentication state.
pub use app_state::AuthState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(not(target_os = "android"))]
pub fn run() {
    tauri::Builder::default()
        .manage(app_state::AuthState::new())
        .manage(domains::account::ApiKeyCache::new())
        .manage(domains::steam::IdlingState::new())
        .manage(domains::system::SystemMonitorState::new())
        .manage(commands::video::DownloadState::new())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_denylist(&["tabs-window", "agent-window"])
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            for arg in args {
                if arg.starts_with("yolnoma://") {
                    if let Ok(parsed_url) = url::Url::parse(&arg) {
                        deep_link::handle_url(app, &parsed_url);
                    }
                }
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
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
                        deep_link::handle_url(&handle, &parsed_url);
                    }
                }
            });
            use tauri::{
                menu::{MenuBuilder, MenuItemBuilder},
                tray::{TrayIconBuilder, TrayIconEvent},
                Manager,
            };

            // Tray menyu
            let idling_item = MenuItemBuilder::new("Steam: Idle")
                .id("idle-status")
                .enabled(true)
                .build(app)?;
            let stop_idling_item = MenuItemBuilder::new("⏹ Stop All Idling")
                .id("idle-stop-all")
                .enabled(false)
                .build(app)?;
            let show = MenuItemBuilder::new("Show").id("show").build(app)?;
            let world_show = MenuItemBuilder::new("3D Show")
                .id("world-3d-show")
                .build(app)?;
            let quit = MenuItemBuilder::new("Exit").id("quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&idling_item)
                .item(&stop_idling_item)
                .separator()
                .item(&show)
                .item(&world_show)
                .item(&quit)
                .build()?;

            let tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Yolnoma")
                .menu(&menu)
                .show_menu_on_left_click(false) // Left click opens window, right click opens menu
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "idle-status" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                            let _ = w.eval("window.location.hash = '#/tools/steam/steam-idler'");
                        }
                    }
                    "idle-stop-all" => {
                        let state = app.state::<domains::steam::IdlingState>();
                        tauri::async_runtime::block_on(async {
                            app_commands::stop_idling_processes(&state).await;
                        });
                    }
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "world-3d-show" => {
                        let _ =
                            tauri::async_runtime::block_on(commands::windows::open_in_new_window(
                                app.clone(),
                                "/tools/world-3d".to_string(),
                                Some("Yolnoma World".to_string()),
                            ));
                    }
                    "quit" => {
                        // Barcha idling jarayonlarini to'xtatamiz, keyin chiqamiz
                        let state = app.state::<domains::steam::IdlingState>();
                        tauri::async_runtime::block_on(async {
                            app_commands::stop_idling_processes(&state).await;
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

            // Background polling loop to dynamically update Tray tooltip and Idling menu item
            let app_handle = app.handle().clone();
            let idling_item_clone = idling_item.clone();
            let stop_idling_clone = stop_idling_item.clone();
            let tray_icon = tray.clone();

            tauri::async_runtime::spawn(async move {
                let mut last_count = usize::MAX;
                loop {
                    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
                    let count = {
                        let state = app_handle.state::<domains::steam::IdlingState>();
                        let guard = state.processes.lock().await;
                        guard.len()
                    };

                    if count != last_count {
                        last_count = count;
                        if count > 0 {
                            let text = format!("🟢 Steam: {} games idling", count);
                            let _ = idling_item_clone.set_text(&text);
                            let _ = stop_idling_clone.set_enabled(true);
                            let _ = tray_icon.set_tooltip(Some(&format!("Yolnoma • {} games idling", count)));
                        } else {
                            let _ = idling_item_clone.set_text("Steam: No active idling");
                            let _ = stop_idling_clone.set_enabled(false);
                            let _ = tray_icon.set_tooltip(Some("Yolnoma"));
                        }
                    }
                }
            });

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
            app_commands::ping,
            app_commands::exit_app,
            app_commands::hide_window,
            app_commands::pick_screen_color,
            app_commands::read_codebase_file,
            app_commands::write_codebase_file,
            domains::git::get_git_changes,
            domains::git::get_git_history,
            app_commands::get_idling_count,
            domains::ai_chat::list_ai_chat_sessions,
            domains::ai_chat::get_ai_chat_session,
            domains::ai_chat::save_ai_chat_session,
            domains::ai_chat::delete_ai_chat_session,
            domains::ai_chat::create_ai_chat_session,
            // ── Account Storage ──
            domains::account::set_current_user,
            domains::account::get_account_config,
            domains::account::save_account_config,
            domains::account::get_api_key,
            domains::account::set_api_key,
            domains::account::clear_api_key,
            commands::proxy::proxy_request,
            commands::proxy::proxy_ep,
            commands::windows::open_in_new_window,
            commands::windows::open_agent_window,
            // ── YouTube Video Downloader ──
            commands::video::download_youtube_video,
            commands::video::cancel_youtube_download,
            commands::video::open_youtube_download_folder,
            commands::video::get_youtube_formats,
            commands::video::preview_youtube_video,
            commands::video::check_yt_dlp_installed,
            commands::video::check_ffmpeg_installed,
            commands::video::check_youtube_libraries,
            commands::video::download_youtube_libraries,
            commands::video::cancel_youtube_library_download,
            // ── Plugins System ──
            commands::plugins::list_local_plugins,
            commands::plugins::read_plugin_source,
            // ── System Monitoring ──
            domains::system::get_system_stats,
            // ── Cleaner ──
            domains::cleaner::run_cleaner,
            // ── Crosshair Overlay ──
            domains::crosshair::start_crosshair_overlay,
            domains::crosshair::stop_crosshair_overlay,
            domains::crosshair::update_crosshair_config,
            domains::crosshair::is_crosshair_active,
            domains::crosshair::save_crosshair_config,
            domains::crosshair::get_saved_crosshair_config,
            // ── Image Converter ──
            domains::image::get_image_info,
            domains::image::get_default_output_dir,
            domains::image::open_output_folder,
            domains::image::convert_image,
            domains::image::convert_images_batch,
            // ── Steam Idler & SAM ──
            domains::steam::steam_is_running,
            domains::steam::get_steam_accounts,
            domains::steam::get_steam_games,
            domains::steam::get_steam_profile,
            domains::steam::start_idling,
            domains::steam::stop_idling,
            domains::steam::stop_all_idling,
            domains::steam::get_idle_state,
            domains::steam::get_achievement_data,
            domains::steam::set_achievement,
            domains::steam::unlock_all_achievements,
            domains::steam::lock_all_achievements,
            domains::steam::update_stats,
            domains::steam::reset_all_stats,
            // ── Port Scanner ──
            domains::network::scan_ports,
            domains::network::get_common_ports,
            // ── Archive Explorer ──
            domains::archive::list_archive_entries,
            domains::archive::read_archive_entry_content,
            domains::archive::extract_single_entry,
            domains::archive::extract_archive,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Last-resort cleanup for OS shutdowns and exits that bypass the tray menu.
            // The tray quit action and exit_app command also clean up eagerly; this
            // callback protects against the remaining Tauri lifecycle paths.
            if let tauri::RunEvent::Exit = event {
                let state = app.state::<domains::steam::IdlingState>();
                tauri::async_runtime::block_on(async {
                    app_commands::stop_idling_processes(&state).await;
                });
            }
        });

}

#[cfg(target_os = "android")]
#[tauri::mobile_entry_point]
pub fn run() {
    tauri::Builder::default()
        .manage(app_state::AuthState::new())
        .manage(mobile_backend::MobileStorage::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            mobile_backend::set_current_user,
            mobile_backend::get_account_config,
            mobile_backend::save_account_config,
            mobile_backend::get_api_key,
            mobile_backend::set_api_key,
            mobile_backend::clear_api_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Android application");
}
