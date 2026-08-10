mod commands;
mod db;
mod models;

#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            ping,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
