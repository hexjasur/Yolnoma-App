use tauri::{AppHandle, Emitter};

/// Dispatch supported `yolnoma://` URLs to frontend events.
pub fn handle_url(app: &AppHandle, url: &url::Url) {
    match url.host_str().unwrap_or_default() {
        "auth" => emit_query_value(app, url, "code", "auth-code-received"),
        "session-limit" => emit_query_value(app, url, "temp_code", "session-limit-reached"),
        _ => {}
    }
}

fn emit_query_value(app: &AppHandle, url: &url::Url, key: &str, event: &str) {
    if let Some((_, value)) = url.query_pairs().find(|(name, _)| name == key) {
        let _ = app.emit(event, value.into_owned());
    }
}
