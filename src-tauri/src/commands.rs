#[tauri::command]
pub async fn proxy_eporner(url: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let res = client
        .get(&url)
        .header("Accept", "application/json")
        .header("Referer", "https://www.eporner.com/")
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
