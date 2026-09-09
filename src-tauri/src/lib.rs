use tauri::Manager;
use tauri_plugin_deep_link::DeepLinkExt;

mod commands;
#[path = "commands/videos.rs"]
mod videos;
mod account_storage;
mod cleaner;
mod crosshair;
mod embedded_api_key;
mod image_converter;
mod steam_idler;
mod system_monitor;
mod port_scanner;
mod archive;
mod app_commands;
mod app_state;
mod deep_link;

// Kept public for feature modules that use the shared authentication state.
pub use app_state::AuthState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(app_state::AuthState::new())
        .manage(account_storage::ApiKeyCache::new())
        .manage(steam_idler::IdlingState::new())
        .manage(system_monitor::SystemMonitorState::new())
            .manage(videos::DownloadState::new())
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
            let show = MenuItemBuilder::new("Show")
                .id("show")
                .build(app)?;
            let world_show = MenuItemBuilder::new("3D Show")
                .id("world-3d-show")
                .build(app)?;
            let quit = MenuItemBuilder::new("Exit")
                .id("quit")
                .build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show)
                .item(&world_show)
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
                    "world-3d-show" => {
                        let _ = tauri::async_runtime::block_on(commands::open_in_new_window(
                            app.clone(),
                            "/tools/world-3d".to_string(),
                            Some("Yolnoma World".to_string()),
                        ));
                    }
                    "quit" => {
                        // Barcha idling jarayonlarini to'xtatamiz, keyin chiqamiz
                        let state = app.state::<steam_idler::IdlingState>();
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
            app_commands::get_idling_count,
            // ── Account Storage ──
            account_storage::set_current_user,
            account_storage::get_account_config,
            account_storage::save_account_config,
            account_storage::get_api_key,
            account_storage::set_api_key,
            account_storage::clear_api_key,
            commands::proxy_request,
            commands::proxy_ep,
            commands::open_in_new_window,
            commands::open_agent_window,
            // ── YouTube Video Downloader ──
            videos::download_youtube_video,
            videos::cancel_youtube_download,
            videos::open_youtube_download_folder,
            videos::get_youtube_formats,
            videos::preview_youtube_video,
            videos::check_yt_dlp_installed,
            videos::check_ffmpeg_installed,
            videos::check_youtube_libraries,
            videos::download_youtube_libraries,
            videos::cancel_youtube_library_download,
            // ── Plugins System ──
            commands::list_local_plugins,
            commands::read_plugin_source,
            // ── System Monitoring ──
            system_monitor::get_system_stats,
            // ── Cleaner ──
            cleaner::run_cleaner,
            // ── Crosshair Overlay ──
            crosshair::start_crosshair_overlay,
            crosshair::stop_crosshair_overlay,
            crosshair::update_crosshair_config,
            crosshair::is_crosshair_active,
            crosshair::save_crosshair_config,
            crosshair::get_saved_crosshair_config,
            // ── Image Converter ──
            image_converter::get_image_info,
            image_converter::get_default_output_dir,
            image_converter::open_output_folder,
            image_converter::convert_image,
            image_converter::convert_images_batch,
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
            // ── Port Scanner ──
            port_scanner::scan_ports,
            port_scanner::get_common_ports,
            // ── Archive Explorer ──
            archive::list_archive_entries,
            archive::read_archive_entry_content,
            archive::extract_single_entry,
            archive::extract_archive,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
