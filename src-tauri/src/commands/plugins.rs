#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct DiscoveredPluginInfo {
    pub dir_name: String,
    pub entry_file: String,
    pub file_path: String,
}

#[tauri::command]
pub async fn list_local_plugins(
    app: tauri::AppHandle,
) -> Result<Vec<DiscoveredPluginInfo>, String> {
    use std::path::PathBuf;
    use tauri::Manager;

    let mut possible_paths = Vec::new();

    // 1. %LOCALAPPDATA%/Yolnoma/plugins
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        possible_paths.push(
            PathBuf::from(local_app_data)
                .join("Yolnoma")
                .join("plugins"),
        );
    }

    // 2. Tauri local data dir / Yolnoma / plugins
    if let Ok(local_dir) = app.path().local_data_dir() {
        possible_paths.push(local_dir.join("Yolnoma").join("plugins"));
        possible_paths.push(local_dir.join("plugins"));
    }

    // 3. User home / AppData / Local / Yolnoma / plugins
    if let Ok(home_dir) = app.path().home_dir() {
        possible_paths.push(
            home_dir
                .join("AppData")
                .join("Local")
                .join("Yolnoma")
                .join("plugins"),
        );
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

/// Reading plugin source code — only files in the 'plugins' folder
/// Path traversal protection: canonicalize() + starts_with() check
#[tauri::command]
pub async fn read_plugin_source(file_path: String) -> Result<String, String> {
    use std::path::Path;

    let path = Path::new(&file_path);

    // Check if the file exists
    if !path.exists() {
        return Err(format!("Plugin file does not exist: {}", file_path));
    }

    // Canonical path — resolves `..` and symlinks.
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Cannot resolve path: {}", e))?;

    // Plugins papkasidan tashqariga chiqishni taqiqlash
    let plugins_root = {
        let local_app_data = std::env::var("LOCALAPPDATA")
            .map_err(|_| "Cannot determine LOCALAPPDATA".to_string())?;
        Path::new(&local_app_data)
            .join("Yolnoma")
            .join("plugins")
            .canonicalize()
            .unwrap_or_else(|_| Path::new(&local_app_data).join("Yolnoma").join("plugins"))
    };

    if !canonical.starts_with(&plugins_root) {
        return Err("Access denied: path is outside the plugins directory".to_string());
    }

    // Read only .js and .json files
    let ext = canonical.extension().and_then(|e| e.to_str()).unwrap_or("");
    if ext != "js" && ext != "json" && ext != "ts" {
        return Err(format!(
            "Only .js/.ts/.json plugin files can be read, got: .{}",
            ext
        ));
    }

    std::fs::read_to_string(&canonical).map_err(|e| format!("Failed to read plugin source: {}", e))
}
