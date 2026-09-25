use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, serde::Serialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub body: Value,
}

fn validate_url(url: &str) -> Result<(), String> {
    let parsed = url
        .parse::<reqwest::Url>()
        .map_err(|_| format!("Invalid URL format: {url}"))?;
    match parsed.scheme() {
        "http" | "https" => {}
        scheme => return Err(format!("Only HTTP/HTTPS URLs are allowed, got: {scheme}")),
    }
    let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
    let blocked = ["169.254.169.254", "metadata.google.internal", "metadata.google"];
    if blocked.contains(&host.as_str()) {
        return Err("Requests to cloud metadata endpoints are not allowed".to_string());
    }
    Ok(())
}

/// Android counterpart of the desktop proxy command. The frontend uses this
/// transport for auth, session-limit requests and the rest of the API.
#[tauri::command]
pub async fn proxy_request(
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<Value>,
) -> Result<ProxyResponse, String> {
    validate_url(&url)?;
    let client = reqwest::Client::builder()
        .user_agent("Yolnoma Android")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| format!("HTTP client error: {error}"))?;

    let mut request = match method.to_ascii_uppercase().as_str() {
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        _ => client.get(&url),
    };

    for (key, value) in headers {
        let lower = key.to_ascii_lowercase();
        if !matches!(lower.as_str(), "host" | "x-forwarded-for" | "x-real-ip" | "forwarded") {
            request = request.header(key, value);
        }
    }
    if let Some(payload) = body {
        request = request.json(&payload);
    }

    let response = request.send().await.map_err(|error| error.to_string())?;
    let status = response.status().as_u16();
    let text = response.text().await.map_err(|error| error.to_string())?;
    let body = serde_json::from_str(&text).unwrap_or_else(|_| serde_json::json!({ "text": text }));
    Ok(ProxyResponse { status, body })
}
