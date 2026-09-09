#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AddTabPayload {
    pub url: String,
    pub title: String,
}

#[tauri::command]
pub async fn open_in_new_window(
    app: tauri::AppHandle,
    url: String,
    title: Option<String>,
) -> Result<(), String> {
    use tauri::{Emitter, Manager};

    let clean_url = url.trim();
    if clean_url.is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    // Process hash route or local app route
    let hash_path = if let Some(stripped) = clean_url.strip_prefix("yolnoma://app/") {
        format!("#/{}", stripped)
    } else if let Some(stripped) = clean_url.strip_prefix("yolnoma://") {
        format!("#/{}", stripped)
    } else if let Some(idx) = clean_url.find('#') {
        clean_url[idx..].to_string()
    } else if clean_url.starts_with('/') {
        format!("#{}", clean_url)
    } else {
        format!("#/{}", clean_url)
    };

    let tab_window_label = "tabs-window";

    // If the tabs window is already open, bring it to front and dispatch the new tab event
    if let Some(tab_win) = app.get_webview_window(tab_window_label) {
        let _ = tab_win.show();
        let _ = tab_win.unminimize();
        let _ = tab_win.set_focus();

        let payload = AddTabPayload {
            url: hash_path,
            title: title.unwrap_or_default(),
        };

        let _ = app.emit_to(tab_window_label, "add-new-tab", payload);
    } else {
        // Create the unified Tab Window with the exact same base origin as the main window
        // so that localStorage, cookies, and authentication state are 100% shared.
        let webview_url = if let Some(main_win) = app.get_webview_window("main") {
            if let Ok(main_url) = main_win.url() {
                let mut target_url = main_url.clone();
                let hash_clean = hash_path.trim_start_matches('#');
                target_url.set_fragment(Some(hash_clean));
                tauri::WebviewUrl::External(target_url)
            } else {
                tauri::WebviewUrl::App(format!("index.html{}", hash_path).into())
            }
        } else {
            tauri::WebviewUrl::App(format!("index.html{}", hash_path).into())
        };

        let builder = tauri::WebviewWindowBuilder::new(&app, tab_window_label, webview_url)
            .title("Yolnoma")
            .inner_size(1150.0, 750.0)
            .min_inner_size(800.0, 500.0)
            .center()
            .decorations(true)
            .resizable(true);

        let new_window = builder
            .build()
            .map_err(|e| format!("Failed to create tabs window: {}", e))?;

        let _ = new_window.set_fullscreen(false);
        let _ = new_window.set_decorations(true);
    }

    Ok(())
}

#[tauri::command]
pub async fn open_agent_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    if let Some(agent_window) = app.get_webview_window("agent-window") {
        let _ = agent_window.show();
        let _ = agent_window.unminimize();
        let _ = agent_window.set_focus();
        return Ok(());
    }

    let webview_url = if let Some(main_window) = app.get_webview_window("main") {
        if let Ok(main_url) = main_window.url() {
            let mut target_url = main_url;
            target_url.set_fragment(Some("/agent"));
            tauri::WebviewUrl::External(target_url)
        } else {
            tauri::WebviewUrl::App("index.html#/agent".into())
        }
    } else {
        tauri::WebviewUrl::App("index.html#/agent".into())
    };

    let agent_win = tauri::WebviewWindowBuilder::new(&app, "agent-window", webview_url)
        .title("Yolnoma Agent")
        .inner_size(960.0, 680.0)
        .min_inner_size(760.0, 520.0)
        .center()
        .decorations(true)
        .resizable(true)
        .build()
        .map_err(|error| format!("Failed to create agent window: {}", error))?;

    let _ = agent_win.set_fullscreen(false);

    Ok(())
}
