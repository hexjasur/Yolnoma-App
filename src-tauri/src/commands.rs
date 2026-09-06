#[tauri::command]
pub async fn proxy_ep(url: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let res = client
        .get(&url)
        .header("Accept", "application/json")
        .header(
            "Referer",
            crate::embedded_api_key::referer().map_err(|e| format!("Referer configuration error: {}", e))?,
        )
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Network error ({}): {}", url, e))?;

    let status = res.status();
    if !status.is_success() {
        return Err(format!("HTTP {} from {}", status, url));
    }

    let json = res
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;

    Ok(json)
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub body: serde_json::Value,
}

#[tauri::command]
pub async fn proxy_request(
    method: String,
    url: String,
    headers: std::collections::HashMap<String, String>,
    body: Option<serde_json::Value>,
) -> Result<ProxyResponse, String> {
    let client = reqwest::Client::new();
    let mut req = match method.to_uppercase().as_str() {
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        _ => client.get(&url),
    };

    for (k, v) in headers {
        req = req.header(k, v);
    }

    if let Some(b) = body {
        req = req.json(&b);
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let text = res.text().await.map_err(|e| e.to_string())?;

    // Try parsing as JSON, fallback to raw string in a JSON object
    let body_json: serde_json::Value = serde_json::from_str(&text)
        .unwrap_or(serde_json::json!({ "text": text }));

    Ok(ProxyResponse { status, body: body_json })
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct DiscoveredPluginInfo {
    pub dir_name: String,
    pub entry_file: String,
    pub file_path: String,
}

#[tauri::command]
pub async fn list_local_plugins(app: tauri::AppHandle) -> Result<Vec<DiscoveredPluginInfo>, String> {
    use std::path::PathBuf;
    use tauri::Manager;

    let mut possible_paths = Vec::new();

    // 1. %LOCALAPPDATA%/Yolnoma/plugins
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        possible_paths.push(PathBuf::from(local_app_data).join("Yolnoma").join("plugins"));
    }

    // 2. Tauri local data dir / Yolnoma / plugins
    if let Ok(local_dir) = app.path().local_data_dir() {
        possible_paths.push(local_dir.join("Yolnoma").join("plugins"));
        possible_paths.push(local_dir.join("plugins"));
    }

    // 3. User home / AppData / Local / Yolnoma / plugins
    if let Ok(home_dir) = app.path().home_dir() {
        possible_paths.push(home_dir.join("AppData").join("Local").join("Yolnoma").join("plugins"));
    }

    let mut found_dir = None;
    for path in possible_paths {
        if path.exists() && path.is_dir() {
            found_dir = Some(path);
            break;
        }
    }

    let plugins_dir = match found_dir {
        Some(p) => p,
        None => return Ok(Vec::new()),
    };

    let mut results = Vec::new();
    let entries = match std::fs::read_dir(&plugins_dir) {
        Ok(e) => e,
        Err(err) => return Err(format!("Failed to read plugins directory: {}", err)),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let dir_name = entry.file_name().to_string_lossy().to_string();
            let plugin_js = path.join("plugin.js");
            let index_js = path.join("index.js");

            let target_file = if plugin_js.exists() {
                Some(("plugin.js".to_string(), plugin_js))
            } else if index_js.exists() {
                Some(("index.js".to_string(), index_js))
            } else {
                None
            };

            if let Some((entry_file, file_path)) = target_file {
                results.push(DiscoveredPluginInfo {
                    dir_name,
                    entry_file,
                    file_path: file_path.to_string_lossy().to_string(),
                });
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn read_plugin_source(file_path: String) -> Result<String, String> {
    use std::path::Path;

    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("Plugin file does not exist: {}", file_path));
    }

    std::fs::read_to_string(path).map_err(|e| format!("Failed to read plugin source: {}", e))
}

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

        builder.build().map_err(|e| format!("Failed to create tabs window: {}", e))?;
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

    tauri::WebviewWindowBuilder::new(&app, "agent-window", webview_url)
        .title("Yolnoma Agent")
        .inner_size(960.0, 680.0)
        .min_inner_size(760.0, 520.0)
        .center()
        .decorations(true)
        .resizable(true)
        .build()
        .map_err(|error| format!("Failed to create agent window: {}", error))?;

    Ok(())
}


